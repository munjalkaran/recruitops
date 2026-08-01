-- Telora demo enrichment and lightweight workflow support.
-- Safe to apply after 202607310002; all demo rows remain organisation scoped.

alter table public.vacancies
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_batch_id uuid references public.demo_data_batches(id) on delete restrict,
  add column if not exists demo_removed_at timestamptz;

alter table public.interviews
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_batch_id uuid references public.demo_data_batches(id) on delete restrict,
  add column if not exists demo_removed_at timestamptz,
  add column if not exists technical_fit_score smallint check (technical_fit_score is null or technical_fit_score between 1 and 5),
  add column if not exists communication_score smallint check (communication_score is null or communication_score between 1 and 5),
  add column if not exists role_fit_score smallint check (role_fit_score is null or role_fit_score between 1 and 5),
  add column if not exists stability_motivation_score smallint check (stability_motivation_score is null or stability_motivation_score between 1 and 5);

create index if not exists vacancies_demo_batch_idx on public.vacancies (demo_batch_id);
create index if not exists interviews_demo_batch_idx on public.interviews (demo_batch_id);

create table if not exists public.candidate_activity (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  activity_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists candidate_activity_candidate_idx on public.candidate_activity (candidate_id, created_at desc);
alter table public.candidate_activity enable row level security;
create policy candidate_activity_select_scoped on public.candidate_activity for select to authenticated using (
  organisation_id = public.current_organisation_id()
  and exists (select 1 from public.candidates c where c.id = candidate_id and c.demo_removed_at is null and (public.current_app_role() = 'admin' or c.owner_id = auth.uid()))
);
revoke all on public.candidate_activity from anon, authenticated;
grant select on public.candidate_activity to authenticated;

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  page text not null check (page in ('pipeline', 'interviews')),
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_views_owner_idx on public.saved_views (organisation_id, owner_id, page);
create trigger saved_views_updated_at before update on public.saved_views for each row execute function public.set_updated_at();
alter table public.saved_views enable row level security;
create policy saved_views_select_scoped on public.saved_views for select to authenticated using (
  organisation_id = public.current_organisation_id() and (owner_id = auth.uid() or (is_shared and public.current_app_role() = 'admin'))
);
create policy saved_views_insert_owner on public.saved_views for insert to authenticated with check (organisation_id = public.current_organisation_id() and owner_id = auth.uid());
create policy saved_views_update_owner on public.saved_views for update to authenticated using (organisation_id = public.current_organisation_id() and owner_id = auth.uid()) with check (organisation_id = public.current_organisation_id() and owner_id = auth.uid());
create policy saved_views_delete_owner on public.saved_views for delete to authenticated using (organisation_id = public.current_organisation_id() and owner_id = auth.uid());
revoke all on public.saved_views from anon, authenticated;
grant select, insert, update, delete on public.saved_views to authenticated;

create table if not exists public.billing_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  legal_name text not null default '',
  billing_address text not null default '',
  gstin text,
  pan text,
  payment_instructions text,
  payment_terms text not null default 'Due within 30 days',
  invoice_prefix text not null default 'TELORA',
  updated_at timestamptz not null default now()
);
alter table public.billing_settings enable row level security;
create policy billing_settings_select_member on public.billing_settings for select to authenticated using (organisation_id = public.current_organisation_id());
create policy billing_settings_insert_admin on public.billing_settings for insert to authenticated with check (organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin');
create policy billing_settings_update_admin on public.billing_settings for update to authenticated using (organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin') with check (organisation_id = public.current_organisation_id());
revoke all on public.billing_settings from anon, authenticated;
grant select on public.billing_settings to authenticated;
grant insert, update on public.billing_settings to authenticated;

drop policy if exists vacancies_select_scoped on public.vacancies;
create policy vacancies_select_scoped on public.vacancies for select to authenticated using (
  organisation_id = public.current_organisation_id() and demo_removed_at is null
  and (public.current_app_role() = 'admin' or assigned_recruiter_id = auth.uid())
);

drop policy if exists interviews_select_scoped on public.interviews;
create policy interviews_select_scoped on public.interviews for select to authenticated using (
  organisation_id = public.current_organisation_id() and demo_removed_at is null
  and (public.current_app_role() = 'admin' or exists (select 1 from public.candidates c where c.id = candidate_id and c.owner_id = auth.uid() and c.demo_removed_at is null))
);

create or replace function public.seed_demo_extensions_for_current_organisation()
returns integer language plpgsql security definer set search_path = public as $$
declare actor public.profiles; batch_id uuid; inserted_count integer := 0; hdfc_id uuid; kotak_id uuid; icici_id uuid; idfc_id uuid; shriram_id uuid; c_id uuid;
begin
  actor := public.assert_admin();
  select b.id into batch_id from public.demo_data_batches b where b.organisation_id = actor.organisation_id and b.status = 'active' order by b.created_at desc limit 1;
  if batch_id is null then return 0; end if;
  if exists (select 1 from public.vacancies where organisation_id = actor.organisation_id and demo_batch_id = batch_id) then return 0; end if;

  insert into public.vacancies (organisation_id, client_name, job_title, location, openings, priority, status, assigned_recruiter_id, is_demo, demo_batch_id)
  values
    (actor.organisation_id, 'HDFC Bank', 'Relationship Manager', 'Delhi NCR', 4, 'High', 'Open', (select id from profiles where organisation_id=actor.organisation_id and role='recruiter' order by email limit 1), true, batch_id),
    (actor.organisation_id, 'Kotak Mahindra Bank', 'Branch Sales Officer', 'Mumbai', 3, 'High', 'Open', (select id from profiles where organisation_id=actor.organisation_id and role='recruiter' order by email desc limit 1), true, batch_id),
    (actor.organisation_id, 'ICICI Bank', 'Credit Analyst', 'Bengaluru', 2, 'Medium', 'Open', (select id from profiles where organisation_id=actor.organisation_id and role='recruiter' order by email limit 1), true, batch_id),
    (actor.organisation_id, 'IDFC First Bank', 'Loan Officer', 'Pune', 3, 'Medium', 'On Hold', (select id from profiles where organisation_id=actor.organisation_id and role='recruiter' order by email desc limit 1), true, batch_id),
    (actor.organisation_id, 'Shriram Finance', 'Collections Executive', 'Chennai', 5, 'Critical', 'Open', (select id from profiles where organisation_id=actor.organisation_id and role='recruiter' order by email limit 1), true, batch_id);
  get diagnostics inserted_count = row_count;
  select id into hdfc_id from vacancies where demo_batch_id=batch_id and client_name='HDFC Bank' and job_title='Relationship Manager' limit 1;
  select id into kotak_id from vacancies where demo_batch_id=batch_id and client_name='Kotak Mahindra Bank' limit 1;
  select id into icici_id from vacancies where demo_batch_id=batch_id and client_name='ICICI Bank' limit 1;
  select id into idfc_id from vacancies where demo_batch_id=batch_id and client_name='IDFC First Bank' limit 1;
  select id into shriram_id from vacancies where demo_batch_id=batch_id and client_name='Shriram Finance' limit 1;

  update candidates set vacancy_id = case when role='Relationship Manager' then hdfc_id when role='Branch Sales Officer' then kotak_id when role='Credit Analyst' then icici_id when role='Loan Officer' then idfc_id when role='Collections Executive' then shriram_id else vacancy_id end,
    current_ctc = case when current_ctc is null then round((experience_years * 1.25 + 5)::numeric, 1) * 100000 else current_ctc end,
    expected_ctc = case when expected_ctc is null then round((experience_years * 1.45 + 6)::numeric, 1) * 100000 else expected_ctc end,
    current_location = coalesce(current_location, case when role in ('Relationship Manager','Branch Sales Officer') then 'Mumbai' when role='Credit Analyst' then 'Bengaluru' else 'Pune' end),
    preferred_location = coalesce(preferred_location, current_location),
    relevant_experience = coalesce(relevant_experience, greatest(experience_years - 0.5, 0)),
    notice_period_days = coalesce(notice_period_days, 30),
    source = coalesce(source, 'Telora sample dataset')
  where organisation_id=actor.organisation_id and demo_batch_id=batch_id;

  select id into c_id from candidates where demo_batch_id=batch_id and name='Vikram Singh' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,kotak_id,'TP1',1,current_date,(localtime+interval '2 hours')::time,now()+interval '2 hours','Asia/Kolkata','Video','https://example.com/telora-demo-tp1','Kotak hiring panel','Pending','Scheduled','Not Due',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Pooja Desai' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,icici_id,'TP1',1,(current_date+1),(localtime+interval '26 hours')::time,now()+interval '26 hours','Asia/Kolkata','Video','https://example.com/telora-demo-tp1-tomorrow','Priya client panel','Confirmed','Scheduled','Not Due',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Rohit Sharma' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,hdfc_id,'Client',1,(current_date+3),(localtime+interval '74 hours')::time,now()+interval '74 hours','Asia/Kolkata','Client Platform','https://example.com/telora-demo-client','HDFC client panel','Pending','Scheduled','Not Due',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Anjali Verma' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,kotak_id,'TP2',2,current_date-1,(localtime-interval '3 hours')::time,now()-interval '2 hours','Asia/Kolkata','Video','https://example.com/telora-demo-feedback','Arjun panel','Confirmed','Completed','Pending',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Imran Khan' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,feedback_summary,recommendation,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,idfc_id,'TP1',1,current_date-2,(localtime-interval '50 hours')::time,now()-interval '50 hours','Asia/Kolkata','Video','https://example.com/telora-demo-received','Sana panel','Confirmed','Completed','Received','Strong field experience and clear communication.','Proceed',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Neha Gupta' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,kotak_id,'Client',1,current_date-3,(localtime-interval '74 hours')::time,now()-interval '74 hours','Asia/Kolkata','Video','https://example.com/telora-demo-no-show','Client panel','Confirmed','No Show','Escalated',true,batch_id,actor.id); end if;
  select id into c_id from candidates where demo_batch_id=batch_id and name='Deepak Rao' and not is_archived limit 1;
  if c_id is not null then insert into interviews (organisation_id,candidate_id,vacancy_id,round_type,round_number,scheduled_date,scheduled_time,scheduled_at,timezone,mode,meeting_link,panel_name,candidate_confirmation_status,interview_status,feedback_status,reschedule_reason,is_demo,demo_batch_id,created_by) values (actor.organisation_id,c_id,shriram_id,'TP2',2,current_date-4,(localtime-interval '98 hours')::time,now()-interval '98 hours','Asia/Kolkata','Phone',null,'Shriram panel','Requested Reschedule','Rescheduled','Not Due','Candidate requested a new time.',true,batch_id,actor.id); end if;
  return inserted_count;
end;
$$;

create or replace function public.remove_demo_extensions()
returns integer language plpgsql security definer set search_path = public as $$
declare actor public.profiles; changed integer;
begin
  actor := public.assert_admin();
  update vacancies v set demo_removed_at=now() where v.organisation_id=actor.organisation_id and v.is_demo and v.demo_removed_at is null and exists(select 1 from demo_data_batches b where b.id=v.demo_batch_id and b.status='active');
  get diagnostics changed = row_count;
  update interviews i set demo_removed_at=now() where i.organisation_id=actor.organisation_id and i.is_demo and i.demo_removed_at is null and exists(select 1 from demo_data_batches b where b.id=i.demo_batch_id and b.status='active');
  return changed;
end;
$$;

create or replace function public.restore_demo_extensions(p_demo_batch_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare actor public.profiles; target uuid;
begin
  actor := public.assert_admin();
  select coalesce(p_demo_batch_id, (select id from demo_data_batches where organisation_id=actor.organisation_id and status='removed' order by removed_at desc limit 1)) into target;
  update vacancies set demo_removed_at=null where organisation_id=actor.organisation_id and demo_batch_id=target;
  update interviews set demo_removed_at=null where organisation_id=actor.organisation_id and demo_batch_id=target;
  return 1;
end;
$$;

revoke all on function public.seed_demo_extensions_for_current_organisation() from public, anon, authenticated;
revoke all on function public.remove_demo_extensions() from public, anon, authenticated;
revoke all on function public.restore_demo_extensions(uuid) from public, anon, authenticated;
grant execute on function public.seed_demo_extensions_for_current_organisation() to authenticated;
grant execute on function public.remove_demo_extensions() to authenticated;
grant execute on function public.restore_demo_extensions(uuid) to authenticated;
