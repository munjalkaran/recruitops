-- Candidate offer, joining, document, and retention foundation.
-- Retention fields are informational only; current invoice eligibility remains Joined.

alter table public.candidates
  add column if not exists offer_status text not null default 'Not Started' check (offer_status in ('Not Started', 'In Discussion', 'Offered', 'Accepted', 'Declined', 'Withdrawn')),
  add column if not exists offered_ctc numeric(12,2) check (offered_ctc is null or offered_ctc >= 0),
  add column if not exists final_ctc numeric(12,2) check (final_ctc is null or final_ctc >= 0),
  add column if not exists offer_date date,
  add column if not exists offer_accepted_date date,
  add column if not exists resignation_date date,
  add column if not exists expected_joining_date date,
  add column if not exists actual_joining_date date,
  add column if not exists joining_risk text not null default 'Low' check (joining_risk in ('Low', 'Medium', 'High')),
  add column if not exists joining_notes text,
  add column if not exists document_checklist jsonb not null default '{}'::jsonb,
  add column if not exists retention_period_days integer check (retention_period_days is null or retention_period_days >= 0),
  add column if not exists retention_start_date date,
  add column if not exists retention_due_date date,
  add column if not exists retention_status text not null default 'Not Started' check (retention_status in ('Not Started', 'In Progress', 'Completed', 'Failed', 'Replacement Required')),
  add column if not exists replacement_guarantee_end_date date,
  add column if not exists invoice_eligibility_date date;

create index if not exists candidates_joining_idx on public.candidates (organisation_id, expected_joining_date, joining_risk);
create index if not exists candidates_retention_idx on public.candidates (organisation_id, retention_status, retention_due_date);

create or replace function public.update_candidate_profile_extensions(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidates; bad_key text;
begin
  actor := public.current_profile();
  select * into candidate from public.candidates where id = p_candidate_id for update;
  if candidate.id is null or candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  if actor.role <> 'admin' and p_updates ? 'vacancy_id' and nullif(p_updates->>'vacancy_id','') is not null and not exists (select 1 from public.vacancies v where v.id = (p_updates->>'vacancy_id')::uuid and v.organisation_id = actor.organisation_id and v.assigned_recruiter_id = actor.id) then raise exception 'Permission denied'; end if;
  select k into bad_key from jsonb_object_keys(p_updates) as keys(k)
    where k not in ('vacancy_id','relevant_experience','current_ctc','expected_ctc','current_location','preferred_location','grade','notice_period_days','last_working_date','past_client_association','source','docs_status','offer_status','offered_ctc','final_ctc','offer_date','offer_accepted_date','resignation_date','expected_joining_date','actual_joining_date','joining_risk','joining_notes','document_checklist','retention_period_days','retention_start_date','retention_due_date','retention_status','replacement_guarantee_end_date','invoice_eligibility_date') limit 1;
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
    document_checklist = case when p_updates ? 'document_checklist' then coalesce(p_updates->'document_checklist', '{}'::jsonb) else document_checklist end,
    retention_period_days = case when p_updates ? 'retention_period_days' then nullif(p_updates->>'retention_period_days','')::integer else retention_period_days end,
    retention_start_date = case when p_updates ? 'retention_start_date' then nullif(p_updates->>'retention_start_date','')::date else retention_start_date end,
    retention_due_date = case when p_updates ? 'retention_due_date' then nullif(p_updates->>'retention_due_date','')::date else retention_due_date end,
    retention_status = case when p_updates ? 'retention_status' then coalesce(nullif(p_updates->>'retention_status',''), 'Not Started') else retention_status end,
    replacement_guarantee_end_date = case when p_updates ? 'replacement_guarantee_end_date' then nullif(p_updates->>'replacement_guarantee_end_date','')::date else replacement_guarantee_end_date end,
    invoice_eligibility_date = case when p_updates ? 'invoice_eligibility_date' then nullif(p_updates->>'invoice_eligibility_date','')::date else invoice_eligibility_date end
  where id = p_candidate_id returning * into result;
  perform public.write_candidate_audit(result.id, 'profile_extensions_updated', to_jsonb(candidate), to_jsonb(result), p_updates);
  return result;
end; $$;

revoke all on function public.update_candidate_profile_extensions(uuid, jsonb) from public;
grant execute on function public.update_candidate_profile_extensions(uuid, jsonb) to authenticated;

create or replace function public.seed_demo_candidate_workflow_for_current_organisation()
returns integer language plpgsql security definer set search_path = public as $$
declare actor public.profiles; batch_id uuid; bajaj_id uuid; changed integer := 0;
begin
  actor := public.assert_admin();
  select b.id into batch_id from public.demo_data_batches b where b.organisation_id = actor.organisation_id and b.status = 'active' order by b.created_at desc limit 1;
  if batch_id is null then return 0; end if;

  if not exists (select 1 from public.vacancies where organisation_id = actor.organisation_id and demo_batch_id = batch_id and client_name = 'Bajaj Finance' and job_title = 'Customer Service Officer') then
    insert into public.vacancies (organisation_id, client_name, job_title, location, openings, priority, status, assigned_recruiter_id, client_hr_name, client_hr_email, minimum_experience, maximum_experience, minimum_ctc, maximum_ctc, is_demo, demo_batch_id)
    values (actor.organisation_id, 'Bajaj Finance', 'Customer Service Officer', 'Hyderabad', 4, 'Medium', 'Open', (select id from profiles where organisation_id = actor.organisation_id and role = 'recruiter' order by email limit 1), 'Megha Iyer', 'megha.iyer@bajajfinance.example', 2, 5, 700000, 1300000, true, batch_id)
    returning id into bajaj_id;
  else
    select id into bajaj_id from public.vacancies where organisation_id = actor.organisation_id and demo_batch_id = batch_id and client_name = 'Bajaj Finance' and job_title = 'Customer Service Officer' limit 1;
  end if;

  update public.vacancies set
    client_hr_name = coalesce(client_hr_name, case client_name when 'HDFC Bank' then 'Nitin Malhotra' when 'Kotak Mahindra Bank' then 'Rhea Shah' when 'ICICI Bank' then 'Karan Sethi' when 'IDFC First Bank' then 'Meera Joshi' when 'Shriram Finance' then 'Vivek Nair' else null end),
    client_hr_email = coalesce(client_hr_email, lower(replace(client_name, ' ', '.')) || '.talent@example.com'),
    minimum_experience = coalesce(minimum_experience, 2),
    maximum_experience = coalesce(maximum_experience, 7),
    minimum_ctc = coalesce(minimum_ctc, 700000),
    maximum_ctc = coalesce(maximum_ctc, 1800000)
  where organisation_id = actor.organisation_id and demo_batch_id = batch_id;

  update public.candidates set
    vacancy_id = coalesce(vacancy_id, case role when 'Relationship Manager' then (select id from vacancies where demo_batch_id=batch_id and client_name='HDFC Bank' limit 1) when 'Branch Sales Officer' then (select id from vacancies where demo_batch_id=batch_id and client_name='Kotak Mahindra Bank' limit 1) when 'Credit Analyst' then (select id from vacancies where demo_batch_id=batch_id and client_name='ICICI Bank' limit 1) when 'Loan Officer' then (select id from vacancies where demo_batch_id=batch_id and client_name='IDFC First Bank' limit 1) when 'Collections Executive' then (select id from vacancies where demo_batch_id=batch_id and client_name='Shriram Finance' limit 1) when 'Customer Service Officer' then bajaj_id else null end),
    relevant_experience = coalesce(relevant_experience, greatest(experience_years - 0.5, 0)),
    current_ctc = coalesce(current_ctc, round((experience_years * 1.2 + 4)::numeric, 1) * 100000),
    expected_ctc = coalesce(expected_ctc, round((experience_years * 1.35 + 5)::numeric, 1) * 100000),
    current_location = coalesce(current_location, case when role in ('Relationship Manager','Branch Sales Officer') then 'Mumbai' when role = 'Credit Analyst' then 'Bengaluru' when role = 'Customer Service Officer' then 'Hyderabad' else 'Pune' end),
    preferred_location = coalesce(preferred_location, current_location),
    grade = coalesce(grade, case when experience_years >= 6 then 'Senior' when experience_years >= 3 then 'Mid-level' else 'Associate' end),
    notice_period_days = coalesce(notice_period_days, case when stage in ('Joined','Invoiced','Paid') then 0 else 30 end),
    source = coalesce(source, 'Telora sample dataset'),
    offer_status = coalesce(nullif(offer_status, 'Not Started'), case when stage in ('Joined','Invoiced','Paid') then 'Accepted' when stage in ('Selected','Documentation') then 'Offered' else 'Not Started' end),
    offered_ctc = coalesce(offered_ctc, expected_ctc),
    final_ctc = coalesce(final_ctc, case when stage in ('Joined','Invoiced','Paid') then expected_ctc else null end),
    offer_date = coalesce(offer_date, case when stage in ('Selected','Documentation','Joined','Invoiced','Paid') then current_date - 10 else null end),
    offer_accepted_date = coalesce(offer_accepted_date, case when stage in ('Joined','Invoiced','Paid') then current_date - 7 else null end),
    expected_joining_date = coalesce(expected_joining_date, case when stage in ('Joined','Invoiced','Paid') then current_date - 3 when stage in ('Selected','Documentation') then current_date + 14 else null end),
    joining_risk = coalesce(joining_risk, case when stage in ('Selected','Documentation') then 'Medium' else 'Low' end),
    joining_notes = coalesce(joining_notes, case when stage in ('Joined','Invoiced','Paid') then 'Joining confirmed by the client.' else 'Keep candidate warm through offer and joining.' end),
    document_checklist = case when document_checklist = '{}'::jsonb then case when stage in ('Joined','Invoiced','Paid') then jsonb_build_object('id_proof',true,'address_proof',true,'education_documents',true,'experience_letters',true,'salary_slips',true,'offer_letter',true,'resignation_proof',true,'appointment_acceptance',true) when stage in ('Selected','Documentation') then jsonb_build_object('id_proof',true,'address_proof',true,'education_documents',true,'experience_letters',false,'salary_slips',false,'offer_letter',true,'resignation_proof',false,'appointment_acceptance',false) else jsonb_build_object('id_proof',true,'address_proof',false,'education_documents',false,'experience_letters',false,'salary_slips',false,'offer_letter',false,'resignation_proof',false,'appointment_acceptance',false) end else document_checklist end
  where organisation_id = actor.organisation_id and demo_batch_id = batch_id and is_demo;
  get diagnostics changed = row_count;

  update public.candidates set actual_joining_date = coalesce(actual_joining_date, current_date - 3), retention_period_days = coalesce(retention_period_days, 90), retention_start_date = coalesce(retention_start_date, current_date - 3), retention_status = coalesce(nullif(retention_status, 'Not Started'), 'In Progress') where organisation_id = actor.organisation_id and demo_batch_id = batch_id and is_demo and stage in ('Joined','Invoiced','Paid');
  update public.candidates set retention_due_date = coalesce(retention_due_date, retention_start_date + retention_period_days), replacement_guarantee_end_date = coalesce(replacement_guarantee_end_date, retention_start_date + retention_period_days), invoice_eligibility_date = coalesce(invoice_eligibility_date, retention_start_date + retention_period_days) where organisation_id = actor.organisation_id and demo_batch_id = batch_id and is_demo and retention_start_date is not null;

  update public.interviews i set
    technical_fit_score = coalesce(i.technical_fit_score, case when i.feedback_status = 'Received' then 4 else null end),
    communication_score = coalesce(i.communication_score, case when i.feedback_status = 'Received' then 4 else null end),
    role_fit_score = coalesce(i.role_fit_score, case when i.feedback_status = 'Received' then 4 else null end),
    stability_motivation_score = coalesce(i.stability_motivation_score, case when i.feedback_status = 'Received' then 3 else null end)
  where i.organisation_id = actor.organisation_id and i.demo_batch_id = batch_id;
  update public.interviews i set feedback_status = 'Received', recommendation = 'Reject', feedback_summary = coalesce(feedback_summary, 'Role scope and location were not aligned.'), rejection_reason = coalesce(rejection_reason, 'Role scope and location were not aligned.'), interview_status = 'Completed', technical_fit_score = 2, communication_score = 3, role_fit_score = 2, stability_motivation_score = 3 from public.candidates c where c.id = i.candidate_id and c.demo_batch_id = batch_id and c.name = 'Anjali Verma';
  update public.interviews i set recommendation = coalesce(recommendation, 'Hold') from public.candidates c where c.id = i.candidate_id and c.demo_batch_id = batch_id and c.name = 'Pooja Desai';
  update public.interviews i set panel_name = null where i.demo_batch_id = batch_id and i.interview_status = 'Scheduled' and i.round_type = 'TP1' and exists (select 1 from public.candidates c where c.id = i.candidate_id and c.name = 'Vikram Singh');

  insert into public.candidate_activity (organisation_id, candidate_id, activity_type, actor_id, summary, metadata, created_at)
  select c.organisation_id, c.id, 'demo_created', coalesce(c.created_by, actor.id), 'Candidate added to the Telora sample pipeline', jsonb_build_object('demo_batch_id', batch_id), c.created_at
  from public.candidates c where c.organisation_id = actor.organisation_id and c.demo_batch_id = batch_id and c.is_demo
    and not exists (select 1 from public.candidate_activity a where a.candidate_id = c.id and a.activity_type = 'demo_created' and a.metadata->>'demo_batch_id' = batch_id::text);
  insert into public.candidate_activity (organisation_id, candidate_id, activity_type, actor_id, summary, metadata, created_at)
  select c.organisation_id, c.id, 'demo_assigned', c.owner_id, case when c.owner_id is null then 'Candidate is awaiting recruiter assignment' else 'Recruiter ownership assigned' end, jsonb_build_object('demo_batch_id', batch_id), c.created_at + interval '1 day'
  from public.candidates c where c.organisation_id = actor.organisation_id and c.demo_batch_id = batch_id and c.is_demo
    and not exists (select 1 from public.candidate_activity a where a.candidate_id = c.id and a.activity_type = 'demo_assigned' and a.metadata->>'demo_batch_id' = batch_id::text);
  insert into public.candidate_activity (organisation_id, candidate_id, activity_type, actor_id, summary, metadata, created_at)
  select c.organisation_id, c.id, 'demo_vacancy_linked', coalesce(c.owner_id, actor.id), 'Candidate linked to client demand', jsonb_build_object('demo_batch_id', batch_id, 'vacancy_id', c.vacancy_id), c.created_at + interval '2 days'
  from public.candidates c where c.organisation_id = actor.organisation_id and c.demo_batch_id = batch_id and c.is_demo and c.vacancy_id is not null
    and not exists (select 1 from public.candidate_activity a where a.candidate_id = c.id and a.activity_type = 'demo_vacancy_linked' and a.metadata->>'demo_batch_id' = batch_id::text);
  insert into public.candidate_activity (organisation_id, candidate_id, activity_type, actor_id, summary, metadata, created_at)
  select c.organisation_id, c.id, 'demo_stage_changed', coalesce(c.owner_id, actor.id), 'Candidate moved to ' || c.stage, jsonb_build_object('demo_batch_id', batch_id, 'stage', c.stage), c.updated_at
  from public.candidates c where c.organisation_id = actor.organisation_id and c.demo_batch_id = batch_id and c.is_demo
    and not exists (select 1 from public.candidate_activity a where a.candidate_id = c.id and a.activity_type = 'demo_stage_changed' and a.metadata->>'demo_batch_id' = batch_id::text);

  return changed;
end; $$;

revoke all on function public.seed_demo_candidate_workflow_for_current_organisation() from public, anon, authenticated;
grant execute on function public.seed_demo_candidate_workflow_for_current_organisation() to authenticated;
