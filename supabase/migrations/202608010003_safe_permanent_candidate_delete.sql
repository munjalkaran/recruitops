-- Safe, organisation-scoped permanent deletion for real archived candidates.
-- Apply after the interview and workflow migrations. Demo candidates remain recoverable.

create or replace function public.permanently_delete_candidate(p_candidate_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  old_row public.candidates;
begin
  actor := public.assert_admin();

  if p_confirmation <> 'PERMANENTLY DELETE' then
    raise exception 'Confirmation phrase does not match';
  end if;

  select * into old_row
  from public.candidates
  where id = p_candidate_id
    and organisation_id = actor.organisation_id
    and is_archived
  for update;

  if old_row.id is null then
    raise exception 'Archived candidate not found';
  end if;

  if old_row.is_demo then
    raise exception 'Sample candidates cannot be permanently deleted; use Remove sample data instead';
  end if;

  -- Invoiced and Paid are the product's finalised billing stages. Keep
  -- those records for accounting retention and ask the user to archive instead.
  if old_row.stage in ('Invoiced', 'Paid') then
    raise exception 'This candidate is linked to a finalised invoice and cannot be permanently deleted. Archive the candidate instead.';
  end if;

  -- Interviews use ON DELETE RESTRICT because interview history is normally
  -- retained. A permanent candidate deletion is the explicit operational
  -- retention action, so remove only the candidate-owned interview rows first.
  delete from public.interviews where candidate_id = p_candidate_id;
  delete from public.candidate_audit_log where candidate_id = p_candidate_id;
  delete from public.candidates where id = p_candidate_id and organisation_id = actor.organisation_id;

  if not found then
    raise exception 'Archived candidate not found';
  end if;

  -- The deletion event contains no candidate foreign key, so it remains as an
  -- organisation-level operational audit record without retaining candidate PII.
  insert into public.candidate_audit_log (organisation_id, candidate_id, actor_id, action, changed_fields)
  values (actor.organisation_id, null, actor.id, 'permanently_deleted', jsonb_build_object('candidate_id', p_candidate_id));
end;
$$;

revoke all on function public.permanently_delete_candidate(uuid, text) from public;
grant execute on function public.permanently_delete_candidate(uuid, text) to authenticated;
