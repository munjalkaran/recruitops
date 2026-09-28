-- Keep retention and invoice-eligibility fields on the admin-only direct update path.

create or replace function public.update_candidate_profile_extensions(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidates; bad_key text;
begin
  actor := public.current_profile();
  select * into candidate from public.candidates where id = p_candidate_id for update;
  if candidate.id is null or candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  if actor.role <> 'admin' and p_updates ? 'vacancy_id' and nullif(p_updates->>'vacancy_id','') is not null and not exists (select 1 from public.vacancies v where v.id = (p_updates->>'vacancy_id')::uuid and v.organisation_id = actor.organisation_id and v.assigned_recruiter_id = actor.id) then raise exception 'Permission denied'; end if;
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
