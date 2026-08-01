-- Interview scheduling and feedback workflow for Telora.
-- This migration is intentionally separate from vacancy and candidate migrations.

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  vacancy_id uuid references public.vacancies(id) on delete set null,
  round_type text not null default 'Other' check (round_type in ('TP1', 'TP2', 'Client', 'HR', 'Other')),
  round_number integer not null default 1 check (round_number > 0),
  scheduled_date date not null,
  scheduled_time time not null,
  scheduled_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  mode text not null default 'Video' check (mode in ('Video', 'Phone', 'In Person', 'Client Platform', 'Other')),
  meeting_link text,
  venue text,
  panel_name text,
  panel_email text,
  panel_user_id uuid references public.profiles(id) on delete set null,
  candidate_confirmation_status text not null default 'Pending' check (candidate_confirmation_status in ('Pending', 'Confirmed', 'Requested Reschedule', 'Declined', 'No Response')),
  interview_status text not null default 'Scheduled' check (interview_status in ('Scheduled', 'Completed', 'No Show', 'Cancelled', 'Rescheduled')),
  feedback_status text not null default 'Not Due' check (feedback_status in ('Not Due', 'Pending', 'Received', 'Escalated')),
  feedback_summary text,
  recommendation text check (recommendation is null or recommendation in ('Proceed', 'Reject', 'Hold', 'Operations Fit', 'Different Role', 'Reschedule', 'No Decision')),
  rejection_reason text,
  reschedule_reason text,
  previous_interview_id uuid references public.interviews(id) on delete set null,
  escalation_required boolean not null default false,
  escalation_reason text,
  escalation_owner_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  feedback_received_at timestamptz,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (meeting_link is not null or venue is not null or mode not in ('Video', 'Client Platform', 'In Person')),
  check (recommendation <> 'Reject' or nullif(btrim(coalesce(rejection_reason, '')), '') is not null)
);

create index interviews_organisation_schedule_idx on public.interviews (organisation_id, scheduled_at);
create index interviews_candidate_idx on public.interviews (candidate_id, scheduled_at desc);
create index interviews_status_idx on public.interviews (organisation_id, interview_status, feedback_status);
create index interviews_panel_idx on public.interviews (organisation_id, panel_user_id);

create or replace function public.validate_interview_organisation()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.candidates c where c.id = new.candidate_id and c.organisation_id = new.organisation_id) then
    raise exception 'Interview candidate must belong to the interview organisation';
  end if;
  if new.vacancy_id is not null and not exists (select 1 from public.vacancies v where v.id = new.vacancy_id and v.organisation_id = new.organisation_id) then
    raise exception 'Interview vacancy must belong to the interview organisation';
  end if;
  if new.panel_user_id is not null and not exists (select 1 from public.profiles p where p.id = new.panel_user_id and p.organisation_id = new.organisation_id and p.is_active) then
    raise exception 'Interview panel user must belong to the interview organisation';
  end if;
  return new;
end;
$$;

create trigger interviews_validate_organisation
before insert or update of organisation_id, candidate_id, vacancy_id, panel_user_id on public.interviews
for each row execute function public.validate_interview_organisation();

create trigger interviews_updated_at before update on public.interviews for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.interviews;

alter table public.interviews enable row level security;

create policy interviews_select_scoped on public.interviews for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (
    public.current_app_role() = 'admin'
    or exists (
      select 1 from public.candidates c
      where c.id = interviews.candidate_id and c.owner_id = auth.uid()
    )
  )
);

create policy interviews_insert_scoped on public.interviews for insert to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and created_by = auth.uid()
  and (
    public.current_app_role() = 'admin'
    or exists (
      select 1 from public.candidates c
      where c.id = interviews.candidate_id and c.owner_id = auth.uid() and not c.is_archived
    )
  )
);

create policy interviews_update_scoped on public.interviews for update to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (
    public.current_app_role() = 'admin'
    or exists (
      select 1 from public.candidates c
      where c.id = interviews.candidate_id and c.owner_id = auth.uid() and not c.is_archived
    )
  )
)
with check (
  organisation_id = public.current_organisation_id()
  and (
    public.current_app_role() = 'admin'
    or exists (
      select 1 from public.candidates c
      where c.id = interviews.candidate_id and c.owner_id = auth.uid() and not c.is_archived
    )
  )
);

revoke all on public.interviews from anon, authenticated;
grant select, insert, update on public.interviews to authenticated;
