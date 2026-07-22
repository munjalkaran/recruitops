create or replace function public.assert_admin()
returns public.profiles language plpgsql stable security definer set search_path = public as $$
declare actor public.profiles;
begin
  actor := public.current_profile();
  if actor.id is null or actor.role <> 'admin' then raise exception 'Admin permission required'; end if;
  return actor;
end;
$$;

create or replace function public.write_candidate_audit(
  p_candidate_id uuid, p_action text, p_old jsonb, p_new jsonb, p_changed_fields jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; org_id uuid;
begin
  actor := public.current_profile();
  org_id := coalesce((p_new->>'organisation_id')::uuid, (p_old->>'organisation_id')::uuid, actor.organisation_id);
  insert into public.candidate_audit_log (organisation_id, candidate_id, actor_id, action, changed_fields, old_record, new_record)
  values (org_id, p_candidate_id, actor.id, p_action, coalesce(p_changed_fields, '{}'::jsonb), p_old, p_new);
end;
$$;

create or replace function public.update_candidate_operations(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
declare allowed text[] := array['stage','docs_status','next_follow_up','last_contact','notes']; bad_key text;
begin
  actor := public.current_profile();
  select * into old_row from public.candidates where id = p_candidate_id for update;
  if old_row.id is null or old_row.organisation_id <> actor.organisation_id then raise exception 'Candidate not found'; end if;
  if actor.role <> 'admin' and (old_row.owner_id <> actor.id or old_row.is_archived) then raise exception 'Permission denied'; end if;
  select k into bad_key from jsonb_object_keys(p_updates) as keys(k) where not (k = any(allowed)) limit 1;
  if bad_key is not null then raise exception 'Field % cannot be updated through operations', bad_key; end if;

  update public.candidates set
    stage = case when p_updates ? 'stage' then p_updates->>'stage' else stage end,
    docs_status = case when p_updates ? 'docs_status' then p_updates->>'docs_status' else docs_status end,
    next_follow_up = case when p_updates ? 'next_follow_up' and nullif(p_updates->>'next_follow_up','') is not null then (p_updates->>'next_follow_up')::date when p_updates ? 'next_follow_up' then null else next_follow_up end,
    last_contact = case when p_updates ? 'last_contact' and nullif(p_updates->>'last_contact','') is not null then (p_updates->>'last_contact')::date when p_updates ? 'last_contact' then null else last_contact end,
    notes = case when p_updates ? 'notes' then p_updates->>'notes' else notes end
  where id = p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id, 'operations_updated', to_jsonb(old_row), to_jsonb(new_row), p_updates);
  return new_row;
end;
$$;

create or replace function public.request_candidate_change(p_candidate_id uuid, p_field_name text, p_proposed_value jsonb, p_reason text)
returns public.candidate_change_requests language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidate_change_requests;
declare protected text[] := array['name','phone','email','current_employer','experience_years','target_bank','role','owner_id','fee'];
begin
  actor := public.current_profile();
  select * into candidate from public.candidates where id = p_candidate_id;
  if actor.role <> 'recruiter' or candidate.organisation_id <> actor.organisation_id or candidate.owner_id <> actor.id or candidate.is_archived then raise exception 'Permission denied'; end if;
  if not (p_field_name = any(protected)) then raise exception 'Field is not protected'; end if;
  if length(btrim(coalesce(p_reason,''))) = 0 then raise exception 'A reason is required'; end if;
  insert into public.candidate_change_requests (organisation_id, candidate_id, requested_by, field_name, old_value, proposed_value, reason)
  values (actor.organisation_id, candidate.id, actor.id, p_field_name, to_jsonb(candidate)->p_field_name, p_proposed_value, btrim(p_reason)) returning * into result;
  return result;
end;
$$;

create or replace function public.review_candidate_change(p_change_request_id uuid, p_decision text, p_review_comment text default '')
returns public.candidate_change_requests language plpgsql security definer set search_path = public as $$
declare actor public.profiles; req public.candidate_change_requests; old_row public.candidates; new_row public.candidates;
begin
  actor := public.assert_admin();
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into req from public.candidate_change_requests where id = p_change_request_id for update;
  if req.id is null or req.organisation_id <> actor.organisation_id or req.status <> 'pending' then raise exception 'Pending request not found'; end if;
  if p_decision = 'approved' then
    select * into old_row from public.candidates where id = req.candidate_id for update;
    update public.candidates set
      name = case when req.field_name='name' then req.proposed_value #>> '{}' else name end,
      phone = case when req.field_name='phone' then req.proposed_value #>> '{}' else phone end,
      email = case when req.field_name='email' then req.proposed_value #>> '{}' else email end,
      current_employer = case when req.field_name='current_employer' then req.proposed_value #>> '{}' else current_employer end,
      experience_years = case when req.field_name='experience_years' then (req.proposed_value #>> '{}')::numeric else experience_years end,
      target_bank = case when req.field_name='target_bank' then req.proposed_value #>> '{}' else target_bank end,
      role = case when req.field_name='role' then req.proposed_value #>> '{}' else role end,
      owner_id = case when req.field_name='owner_id' and nullif(req.proposed_value #>> '{}','') is not null then (req.proposed_value #>> '{}')::uuid when req.field_name='owner_id' then null else owner_id end,
      fee = case when req.field_name='fee' then (req.proposed_value #>> '{}')::numeric else fee end
    where id = req.candidate_id returning * into new_row;
    perform public.write_candidate_audit(req.candidate_id, 'change_request_approved', to_jsonb(old_row), to_jsonb(new_row), jsonb_build_object(req.field_name, req.proposed_value));
  end if;
  update public.candidate_change_requests set status=p_decision::public.change_request_status, reviewed_by=actor.id, review_comment=coalesce(p_review_comment,''), reviewed_at=now()
  where id=req.id returning * into req;
  return req;
end;
$$;

create or replace function public.archive_candidate(p_candidate_id uuid)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
begin
  actor := public.current_profile(); select * into old_row from public.candidates where id=p_candidate_id for update;
  if old_row.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and old_row.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  update public.candidates set is_archived=true, archived_at=now(), archived_by=actor.id where id=p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id,'archived',to_jsonb(old_row),to_jsonb(new_row)); return new_row;
end;
$$;

create or replace function public.restore_candidate(p_candidate_id uuid)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
begin
  actor := public.assert_admin(); select * into old_row from public.candidates where id=p_candidate_id and organisation_id=actor.organisation_id for update;
  if old_row.id is null then raise exception 'Candidate not found'; end if;
  update public.candidates set is_archived=false, archived_at=null, archived_by=null where id=p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id,'restored',to_jsonb(old_row),to_jsonb(new_row)); return new_row;
end;
$$;

create or replace function public.permanently_delete_candidate(p_candidate_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates;
begin
  actor := public.assert_admin();
  if p_confirmation <> 'PERMANENTLY DELETE' then raise exception 'Confirmation phrase does not match'; end if;
  select * into old_row from public.candidates where id=p_candidate_id and organisation_id=actor.organisation_id and is_archived for update;
  if old_row.id is null then raise exception 'Archived candidate not found'; end if;
  delete from public.candidate_audit_log where candidate_id=p_candidate_id;
  delete from public.candidates where id=p_candidate_id;
  insert into public.candidate_audit_log(organisation_id,candidate_id,actor_id,action,changed_fields)
  values(actor.organisation_id,null,actor.id,'permanently_deleted',jsonb_build_object('candidate_id',p_candidate_id));
end;
$$;

create or replace function public.assign_candidate_owner(p_candidate_id uuid, p_owner_id uuid)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
begin
  actor := public.assert_admin(); select * into old_row from public.candidates where id=p_candidate_id and organisation_id=actor.organisation_id for update;
  if old_row.id is null then raise exception 'Candidate not found'; end if;
  if p_owner_id is not null and not exists(select 1 from public.profiles where id=p_owner_id and organisation_id=actor.organisation_id and role='recruiter' and is_active) then raise exception 'Owner must be an active recruiter in this organisation'; end if;
  update public.candidates set owner_id=p_owner_id where id=p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id,'owner_assigned',to_jsonb(old_row),to_jsonb(new_row),jsonb_build_object('owner_id',p_owner_id)); return new_row;
end;
$$;

create or replace function public.create_candidate(p_candidate jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; result public.candidates; owner uuid;
begin
  actor := public.assert_admin(); owner := nullif(p_candidate->>'owner_id','')::uuid;
  if owner is not null and not exists(select 1 from public.profiles where id=owner and organisation_id=actor.organisation_id and role='recruiter' and is_active) then raise exception 'Owner must be an active recruiter in this organisation'; end if;
  insert into public.candidates(organisation_id,name,phone,email,current_employer,experience_years,target_bank,role,stage,owner_id,docs_status,fee,next_follow_up,last_contact,notes,created_by)
  values(actor.organisation_id,coalesce(nullif(btrim(p_candidate->>'name'),''),'New candidate'),p_candidate->>'phone',p_candidate->>'email',p_candidate->>'current_employer',nullif(p_candidate->>'experience_years','')::numeric,p_candidate->>'target_bank',p_candidate->>'role',coalesce(nullif(p_candidate->>'stage',''),'Sourced'),owner,coalesce(nullif(p_candidate->>'docs_status',''),'Pending'),coalesce(nullif(p_candidate->>'fee','')::numeric,0),nullif(p_candidate->>'next_follow_up','')::date,nullif(p_candidate->>'last_contact','')::date,p_candidate->>'notes',actor.id)
  returning * into result;
  perform public.write_candidate_audit(result.id,'created',null,to_jsonb(result),p_candidate); return result;
end;
$$;

create or replace function public.record_email_draft_opened(p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates;
begin
  actor := public.current_profile();
  select * into candidate from public.candidates where id=p_candidate_id;
  if candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  perform public.write_candidate_audit(candidate.id,'email_draft_opened',to_jsonb(candidate),to_jsonb(candidate));
end;
$$;

create or replace function public.record_duplicate_warning_dismissed(p_candidate_id uuid, p_linked_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates;
begin
  actor := public.current_profile(); select * into candidate from public.candidates where id=p_candidate_id;
  if candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  perform public.write_candidate_audit(candidate.id,'duplicate_warning_dismissed',to_jsonb(candidate),to_jsonb(candidate),jsonb_build_object('linked_candidate_id',p_linked_candidate_id));
end;
$$;

create or replace function public.link_candidate_records(p_candidate_id uuid, p_linked_candidate_id uuid)
returns public.candidate_links language plpgsql security definer set search_path = public as $$
declare actor public.profiles; first_candidate public.candidates; second_candidate public.candidates; result public.candidate_links;
begin
  actor := public.current_profile();
  select * into first_candidate from public.candidates where id=p_candidate_id;
  select * into second_candidate from public.candidates where id=p_linked_candidate_id;
  if first_candidate.organisation_id <> actor.organisation_id or second_candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and first_candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  insert into public.candidate_links(organisation_id,candidate_id,linked_candidate_id,created_by)
  values(actor.organisation_id,p_candidate_id,p_linked_candidate_id,actor.id)
  on conflict(candidate_id,linked_candidate_id) do update set link_type='duplicate'
  returning * into result;
  perform public.write_candidate_audit(first_candidate.id,'candidate_linked',to_jsonb(first_candidate),to_jsonb(first_candidate),jsonb_build_object('linked_candidate_id',p_linked_candidate_id));
  return result;
end;
$$;

revoke all on function public.assert_admin() from public;
revoke all on function public.write_candidate_audit(uuid,text,jsonb,jsonb,jsonb) from public;
revoke all on function public.update_candidate_operations(uuid,jsonb) from public;
revoke all on function public.request_candidate_change(uuid,text,jsonb,text) from public;
revoke all on function public.review_candidate_change(uuid,text,text) from public;
revoke all on function public.archive_candidate(uuid) from public;
revoke all on function public.restore_candidate(uuid) from public;
revoke all on function public.permanently_delete_candidate(uuid,text) from public;
revoke all on function public.assign_candidate_owner(uuid,uuid) from public;
revoke all on function public.create_candidate(jsonb) from public;
revoke all on function public.record_email_draft_opened(uuid) from public;
revoke all on function public.record_duplicate_warning_dismissed(uuid,uuid) from public;
revoke all on function public.link_candidate_records(uuid,uuid) from public;
grant execute on function public.update_candidate_operations(uuid,jsonb), public.request_candidate_change(uuid,text,jsonb,text), public.review_candidate_change(uuid,text,text), public.archive_candidate(uuid), public.restore_candidate(uuid), public.permanently_delete_candidate(uuid,text), public.assign_candidate_owner(uuid,uuid), public.create_candidate(jsonb), public.record_email_draft_opened(uuid), public.record_duplicate_warning_dismissed(uuid,uuid), public.link_candidate_records(uuid,uuid) to authenticated;
