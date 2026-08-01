do $$ begin create type public.vacancy_priority as enum ('Low','Medium','High','Critical'); exception when duplicate_object then null; end $$;
do $$ begin create type public.vacancy_status as enum ('Open','On Hold','Closed','Filled'); exception when duplicate_object then null; end $$;

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  client_name text not null,
  job_title text not null,
  job_description text,
  location text,
  minimum_experience numeric(5,2) check (minimum_experience is null or minimum_experience >= 0),
  maximum_experience numeric(5,2) check (maximum_experience is null or maximum_experience >= minimum_experience),
  minimum_ctc numeric(12,2) check (minimum_ctc is null or minimum_ctc >= 0),
  maximum_ctc numeric(12,2) check (maximum_ctc is null or maximum_ctc >= minimum_ctc),
  openings integer not null default 1 check (openings > 0),
  priority public.vacancy_priority not null default 'Medium',
  status public.vacancy_status not null default 'Open',
  assigned_recruiter_id uuid references public.profiles(id) on delete set null,
  client_hr_name text,
  client_hr_email text,
  client_hr_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vacancies_org_idx on public.vacancies (organisation_id);
create index vacancies_recruiter_idx on public.vacancies (assigned_recruiter_id);
create index vacancies_filters_idx on public.vacancies (organisation_id, status, priority);
alter table public.candidates add column vacancy_id uuid references public.vacancies(id) on delete set null;
alter table public.candidates add column relevant_experience numeric(5,2) check (relevant_experience is null or relevant_experience >= 0);
alter table public.candidates add column current_ctc numeric(12,2) check (current_ctc is null or current_ctc >= 0);
alter table public.candidates add column expected_ctc numeric(12,2) check (expected_ctc is null or expected_ctc >= 0);
alter table public.candidates add column current_location text;
alter table public.candidates add column preferred_location text;
alter table public.candidates add column grade text;
alter table public.candidates add column notice_period_days integer check (notice_period_days is null or notice_period_days >= 0);
alter table public.candidates add column last_working_date date;
alter table public.candidates add column past_client_association boolean;
alter table public.candidates add column source text;
create index candidates_vacancy_idx on public.candidates (vacancy_id);
create trigger vacancies_updated_at before update on public.vacancies for each row execute function public.set_updated_at();
alter table public.vacancies enable row level security;
create policy vacancies_select_scoped on public.vacancies for select to authenticated using (
  organisation_id = public.current_organisation_id() and
  (public.current_app_role() = 'admin' or assigned_recruiter_id = auth.uid())
);
create policy vacancies_insert_admin on public.vacancies for insert to authenticated with check (
  organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin'
);
create policy vacancies_update_admin on public.vacancies for update to authenticated using (
  organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin'
) with check (organisation_id = public.current_organisation_id());
grant select on public.vacancies to authenticated;
grant insert, update on public.vacancies to authenticated;

create or replace function public.validate_vacancy_organisation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.assigned_recruiter_id is not null and not exists (select 1 from public.profiles p where p.id = new.assigned_recruiter_id and p.organisation_id = new.organisation_id) then raise exception 'Assigned recruiter must belong to the vacancy organisation'; end if;
  return new;
end; $$;
create trigger vacancies_validate_organisation before insert or update of organisation_id, assigned_recruiter_id on public.vacancies for each row execute function public.validate_vacancy_organisation();

create or replace function public.validate_candidate_vacancy_organisation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.vacancy_id is not null and not exists (select 1 from public.vacancies v where v.id = new.vacancy_id and v.organisation_id = new.organisation_id) then raise exception 'Candidate vacancy must belong to the candidate organisation'; end if;
  return new;
end; $$;
create trigger candidates_validate_vacancy_organisation before insert or update of organisation_id, vacancy_id on public.candidates for each row execute function public.validate_candidate_vacancy_organisation();

create or replace function public.update_candidate_profile_extensions(p_candidate_id uuid, p_updates jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; candidate public.candidates; result public.candidates; bad_key text;
begin
  actor := public.current_profile();
  select * into candidate from public.candidates where id = p_candidate_id for update;
  if candidate.id is null or candidate.organisation_id <> actor.organisation_id or (actor.role <> 'admin' and candidate.owner_id <> actor.id) then raise exception 'Permission denied'; end if;
  if actor.role <> 'admin' and p_updates ? 'vacancy_id' and nullif(p_updates->>'vacancy_id','') is not null and not exists (select 1 from public.vacancies v where v.id = (p_updates->>'vacancy_id')::uuid and v.organisation_id = actor.organisation_id and v.assigned_recruiter_id = actor.id) then raise exception 'Permission denied'; end if;
  select k into bad_key from jsonb_object_keys(p_updates) as keys(k)
    where k not in ('vacancy_id','relevant_experience','current_ctc','expected_ctc','current_location','preferred_location','grade','notice_period_days','last_working_date','past_client_association','source') limit 1;
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
    source = case when p_updates ? 'source' then nullif(p_updates->>'source','') else source end
  where id = p_candidate_id returning * into result;
  return result;
end; $$;
revoke all on function public.update_candidate_profile_extensions(uuid, jsonb) from public;
grant execute on function public.update_candidate_profile_extensions(uuid, jsonb) to authenticated;

-- Keep the existing create_candidate RPC compatible with imports and future forms.
create or replace function public.create_candidate(p_candidate jsonb)
returns public.candidates language plpgsql security definer set search_path = public as $$
declare actor public.profiles; result public.candidates; owner uuid;
begin
  actor := public.assert_admin(); owner := nullif(p_candidate->>'owner_id','')::uuid;
  insert into public.candidates(organisation_id,name,phone,email,current_employer,experience_years,target_bank,role,stage,owner_id,docs_status,fee,next_follow_up,last_contact,notes,created_by,vacancy_id,relevant_experience,current_ctc,expected_ctc,current_location,preferred_location,grade,notice_period_days,last_working_date,past_client_association)
  values(actor.organisation_id,coalesce(nullif(btrim(p_candidate->>'name'),''),'New candidate'),p_candidate->>'phone',p_candidate->>'email',p_candidate->>'current_employer',nullif(p_candidate->>'experience_years','')::numeric,p_candidate->>'target_bank',p_candidate->>'role',coalesce(nullif(p_candidate->>'stage',''),'Sourced'),owner,coalesce(nullif(p_candidate->>'docs_status',''),'Pending'),coalesce(nullif(p_candidate->>'fee','')::numeric,0),nullif(p_candidate->>'next_follow_up','')::date,nullif(p_candidate->>'last_contact','')::date,p_candidate->>'notes',actor.id,nullif(p_candidate->>'vacancy_id','')::uuid,nullif(p_candidate->>'relevant_experience','')::numeric,nullif(p_candidate->>'current_ctc','')::numeric,nullif(p_candidate->>'expected_ctc','')::numeric,p_candidate->>'current_location',p_candidate->>'preferred_location',p_candidate->>'grade',nullif(p_candidate->>'notice_period_days','')::integer,nullif(p_candidate->>'last_working_date','')::date,case when p_candidate ? 'past_client_association' then (p_candidate->>'past_client_association')::boolean else null end)
  returning * into result;
  perform public.write_candidate_audit(result.id,'created',null,to_jsonb(result),p_candidate); return result;
end; $$;
