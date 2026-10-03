-- Reject authenticated callers who do not have an active profile before any
-- privileged candidate RPC evaluates organisation, role, or ownership checks.

create or replace function public.update_candidate_operations(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
declare allowed text[] := array['stage','docs_status','next_follow_up','last_contact','actual_joining_date','notes']; bad_key text;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into old_row from public.candidates where id = p_candidate_id for update;
  if old_row.id is null or old_row.organisation_id <> actor.organisation_id then raise exception 'Candidate not found'; end if;
  if actor.role = 'recruiter' and (old_row.owner_id <> actor.id or old_row.is_archived) then raise exception 'Permission denied'; end if;
  select k into bad_key from jsonb_object_keys(p_updates) as keys(k) where not (k = any(allowed)) limit 1;
  if bad_key is not null then raise exception 'Field % cannot be updated through operations', bad_key; end if;

  update public.candidates set
    stage = case when p_updates ? 'stage' then p_updates->>'stage' else stage end,
    docs_status = case when p_updates ? 'docs_status' then p_updates->>'docs_status' else docs_status end,
    next_follow_up = case when p_updates ? 'next_follow_up' and nullif(p_updates->>'next_follow_up','') is not null then (p_updates->>'next_follow_up')::date when p_updates ? 'next_follow_up' then null else next_follow_up end,
    last_contact = case when p_updates ? 'last_contact' and nullif(p_updates->>'last_contact','') is not null then (p_updates->>'last_contact')::date when p_updates ? 'last_contact' then null else last_contact end,
    actual_joining_date = case when p_updates ? 'actual_joining_date' and nullif(p_updates->>'actual_joining_date','') is not null then (p_updates->>'actual_joining_date')::date when p_updates ? 'actual_joining_date' then null else actual_joining_date end,
    notes = case when p_updates ? 'notes' then p_updates->>'notes' else notes end
  where id = p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id, 'operations_updated', to_jsonb(old_row), to_jsonb(new_row), p_updates);
  return new_row;
end;
$$;

revoke all on function public.update_candidate_operations(uuid,jsonb) from public;
grant execute on function public.update_candidate_operations(uuid,jsonb) to authenticated;

create or replace function public.update_candidate_profile_extensions(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidates; bad_key text;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into candidate from public.candidates where id = p_candidate_id for update;
  if candidate.id is null or candidate.organisation_id <> actor.organisation_id or (actor.role = 'recruiter' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  if actor.role = 'recruiter' and p_updates ? 'vacancy_id' and nullif(p_updates->>'vacancy_id','') is not null and not exists (select 1 from public.vacancies v where v.id = (p_updates->>'vacancy_id')::uuid and v.organisation_id = actor.organisation_id and v.assigned_recruiter_id = actor.id) then raise exception 'Permission denied'; end if;
  select k into bad_key from jsonb_object_keys(p_updates) as keys(k)
    where k not in ('vacancy_id','relevant_experience','current_ctc','expected_ctc','current_location','preferred_location','grade','notice_period_days','last_working_date','past_client_association','source','docs_status','offer_status','offered_ctc','final_ctc','offer_date','offer_accepted_date','resignation_date','expected_joining_date','actual_joining_date','joining_risk','joining_notes','document_checklist') limit 1;
  if bad_key is not null then raise exception 'Field % cannot be updated', bad_key; end if;
  update public.candidates set
    vacancy_id = case when p_updates ? 'vacancy_id' then nullif(p_updates->>'vacancy_id','')::uuid else vacancy_id end,
    relevant_experience = case when p_updates ? 'relevant_experience' then nullif(p_updates->>'relevant_experience','')::numeric else relevant_experience end,
    current_ctc = case when p_updates ? 'current_ctc' then nullif(p_updates->>'current_ctc','')::numeric else current_ctc end,
    expected_ctc = case when p_updates ? 'expected_ctc' then nullif(p_updates->>'expected_ctc','')::numeric else expected_ctc end,
    current_location = case when p_updates ? 'current_location' then nullif(p_updates->>'current_location','') else current_location end,
    preferred_location = case when p_updates ? 'preferred_location' then nullif(p_updates->>'preferred_location','') else preferred_location end,
    grade = case when p_updates ? 'grade' then nullif(p_updates->>'grade','') else grade end,
    notice_period_days = case when p_updates ? 'notice_period_days' then nullif(p_updates->>'notice_period_days','')::integer else notice_period_days end,
    last_working_date = case when p_updates ? 'last_working_date' then nullif(p_updates->>'last_working_date','')::date else last_working_date end,
    past_client_association = case when p_updates ? 'past_client_association' then (p_updates->>'past_client_association')::boolean else past_client_association end,
    source = case when p_updates ? 'source' then nullif(p_updates->>'source','') else source end,
    docs_status = case when p_updates ? 'docs_status' then coalesce(nullif(p_updates->>'docs_status',''), 'Pending') else docs_status end,
    offer_status = case when p_updates ? 'offer_status' then coalesce(nullif(p_updates->>'offer_status',''), 'Not Started') else offer_status end,
    offered_ctc = case when p_updates ? 'offered_ctc' then nullif(p_updates->>'offered_ctc','')::numeric else offered_ctc end,
    final_ctc = case when p_updates ? 'final_ctc' then nullif(p_updates->>'final_ctc','')::numeric else final_ctc end,
    offer_date = case when p_updates ? 'offer_date' then nullif(p_updates->>'offer_date','')::date else offer_date end,
    offer_accepted_date = case when p_updates ? 'offer_accepted_date' then nullif(p_updates->>'offer_accepted_date','')::date else offer_accepted_date end,
    resignation_date = case when p_updates ? 'resignation_date' then nullif(p_updates->>'resignation_date','')::date else resignation_date end,
    expected_joining_date = case when p_updates ? 'expected_joining_date' then nullif(p_updates->>'expected_joining_date','')::date else expected_joining_date end,
    actual_joining_date = case when p_updates ? 'actual_joining_date' then nullif(p_updates->>'actual_joining_date','')::date else actual_joining_date end,
    joining_risk = case when p_updates ? 'joining_risk' then coalesce(nullif(p_updates->>'joining_risk',''), 'Low') else joining_risk end,
    joining_notes = case when p_updates ? 'joining_notes' then nullif(p_updates->>'joining_notes','') else joining_notes end,
    document_checklist = case when p_updates ? 'document_checklist' then coalesce(p_updates->'document_checklist', '{}'::jsonb) else document_checklist end
  where id = p_candidate_id returning * into result;
  perform public.write_candidate_audit(result.id, 'profile_extensions_updated', to_jsonb(candidate), to_jsonb(result), p_updates);
  return result;
end; $$;

revoke all on function public.update_candidate_profile_extensions(uuid, jsonb) from public;
grant execute on function public.update_candidate_profile_extensions(uuid, jsonb) to authenticated;

create or replace function public.request_candidate_change(p_candidate_id uuid, p_field_name text, p_proposed_value jsonb, p_reason text)
returns public.candidate_change_requests language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidate_change_requests;
declare protected text[] := array['name','phone','email','current_employer','experience_years','target_bank','role','owner_id','fee'];
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into candidate from public.candidates where id = p_candidate_id;
  if actor.role = 'admin' or candidate.organisation_id <> actor.organisation_id or candidate.owner_id <> actor.id or candidate.is_archived then raise exception 'Permission denied'; end if;
  if not (p_field_name = any(protected)) then raise exception 'Field is not protected'; end if;
  if length(btrim(coalesce(p_reason,''))) = 0 then raise exception 'A reason is required'; end if;
  insert into public.candidate_change_requests (organisation_id, candidate_id, requested_by, field_name, old_value, proposed_value, reason)
  values (actor.organisation_id, candidate.id, actor.id, p_field_name, to_jsonb(candidate)->p_field_name, p_proposed_value, btrim(p_reason)) returning * into result;
  return result;
end;
$$;

create or replace function public.archive_candidate(p_candidate_id uuid)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into old_row from public.candidates where id=p_candidate_id for update;
  if old_row.organisation_id <> actor.organisation_id or (actor.role = 'recruiter' and old_row.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  update public.candidates set is_archived=true, archived_at=now(), archived_by=actor.id where id=p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id,'archived',to_jsonb(old_row),to_jsonb(new_row)); return new_row;
end;
$$;

create or replace function public.record_email_draft_opened(p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into candidate from public.candidates where id=p_candidate_id;
  if candidate.organisation_id <> actor.organisation_id or (actor.role = 'recruiter' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  perform public.write_candidate_audit(candidate.id,'email_draft_opened',to_jsonb(candidate),to_jsonb(candidate));
end;
$$;

create or replace function public.record_duplicate_warning_dismissed(p_candidate_id uuid, p_linked_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into candidate from public.candidates where id=p_candidate_id;
  if candidate.organisation_id <> actor.organisation_id or (actor.role = 'recruiter' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  perform public.write_candidate_audit(candidate.id,'duplicate_warning_dismissed',to_jsonb(candidate),to_jsonb(candidate),jsonb_build_object('linked_candidate_id',p_linked_candidate_id));
end;
$$;

create or replace function public.link_candidate_records(p_candidate_id uuid, p_linked_candidate_id uuid)
returns public.candidate_links language plpgsql security definer set search_path = public as $$
declare actor public.profiles; first_candidate public.candidates; second_candidate public.candidates; result public.candidate_links;
begin
  actor := public.current_profile();
  if actor.id is null then raise exception 'Permission denied'; end if;
  select * into first_candidate from public.candidates where id=p_candidate_id;
  select * into second_candidate from public.candidates where id=p_linked_candidate_id;
  if first_candidate.organisation_id <> actor.organisation_id or second_candidate.organisation_id <> actor.organisation_id or (actor.role = 'recruiter' and first_candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  insert into public.candidate_links(organisation_id,candidate_id,linked_candidate_id,created_by)
  values(actor.organisation_id,p_candidate_id,p_linked_candidate_id,actor.id)
  on conflict(candidate_id,linked_candidate_id) do update set link_type='duplicate'
  returning * into result;
  perform public.write_candidate_audit(first_candidate.id,'candidate_linked',to_jsonb(first_candidate),to_jsonb(first_candidate),jsonb_build_object('linked_candidate_id',p_linked_candidate_id));
  return result;
end;
$$;

revoke all on function public.request_candidate_change(uuid,text,jsonb,text) from public;
revoke all on function public.archive_candidate(uuid) from public;
revoke all on function public.record_email_draft_opened(uuid) from public;
revoke all on function public.record_duplicate_warning_dismissed(uuid,uuid) from public;
revoke all on function public.link_candidate_records(uuid,uuid) from public;
grant execute on function public.update_candidate_operations(uuid,jsonb), public.request_candidate_change(uuid,text,jsonb,text), public.review_candidate_change(uuid,text,text), public.archive_candidate(uuid), public.restore_candidate(uuid), public.permanently_delete_candidate(uuid,text), public.assign_candidate_owner(uuid,uuid), public.create_candidate(jsonb), public.record_email_draft_opened(uuid), public.record_duplicate_warning_dismissed(uuid,uuid), public.link_candidate_records(uuid,uuid) to authenticated;
