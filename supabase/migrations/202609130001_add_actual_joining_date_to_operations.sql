-- Allow recruiters to set the invoice-driving actual joining date through the
-- same operational RPC used by inline pipeline edits.

create or replace function public.update_candidate_operations(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates; new_row public.candidates;
declare allowed text[] := array['stage','docs_status','next_follow_up','last_contact','actual_joining_date','notes']; bad_key text;
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
    actual_joining_date = case when p_updates ? 'actual_joining_date' and nullif(p_updates->>'actual_joining_date','') is not null then (p_updates->>'actual_joining_date')::date when p_updates ? 'actual_joining_date' then null else actual_joining_date end,
    notes = case when p_updates ? 'notes' then p_updates->>'notes' else notes end
  where id = p_candidate_id returning * into new_row;
  perform public.write_candidate_audit(p_candidate_id, 'operations_updated', to_jsonb(old_row), to_jsonb(new_row), p_updates);
  return new_row;
end;
$$;

revoke all on function public.update_candidate_operations(uuid,jsonb) from public;
grant execute on function public.update_candidate_operations(uuid,jsonb) to authenticated;
