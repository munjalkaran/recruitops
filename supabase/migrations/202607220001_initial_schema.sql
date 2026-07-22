create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'recruiter');
create type public.change_request_status as enum ('pending', 'approved', 'rejected');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_code text not null default 'free',
  active_user_limit integer not null default 15 check (active_user_limit between 1 and 15),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null,
  email text,
  role public.app_role not null default 'recruiter',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_organisation_idx on public.profiles (organisation_id);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  current_employer text,
  experience_years numeric(5,2) check (experience_years is null or experience_years >= 0),
  target_bank text,
  role text,
  stage text not null default 'Sourced' check (stage in ('Sourced','Contacted','Screened','Interviewing','Selected','Documentation','Joined','Invoiced','Paid','Dropped')),
  owner_id uuid references public.profiles(id) on delete set null,
  docs_status text not null default 'Pending' check (docs_status in ('Pending','Partial','Complete')),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  next_follow_up date,
  last_contact date,
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_organisation_idx on public.candidates (organisation_id);
create index candidates_owner_idx on public.candidates (owner_id);
create index candidates_follow_up_idx on public.candidates (next_follow_up) where is_archived = false;

create table public.candidate_change_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  field_name text not null check (field_name in ('name','phone','email','current_employer','experience_years','target_bank','role','owner_id','fee')),
  old_value jsonb,
  proposed_value jsonb,
  reason text not null check (length(btrim(reason)) > 0),
  status public.change_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index candidate_change_requests_one_pending_idx
  on public.candidate_change_requests (candidate_id, field_name)
  where status = 'pending';

create table public.candidate_audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz not null default now()
);

create index candidate_audit_log_candidate_idx on public.candidate_audit_log (candidate_id, created_at desc);

create table public.candidate_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  linked_candidate_id uuid not null references public.candidates(id) on delete cascade,
  link_type text not null default 'duplicate',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (candidate_id <> linked_candidate_id),
  unique (candidate_id, linked_candidate_id)
);

create table public.organisation_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  display_name text not null,
  email_signature text not null default '',
  default_email_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_updated_at before update on public.organisations for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger candidates_updated_at before update on public.candidates for each row execute function public.set_updated_at();
create trigger change_requests_updated_at before update on public.candidate_change_requests for each row execute function public.set_updated_at();
create trigger candidate_links_updated_at before update on public.candidate_links for each row execute function public.set_updated_at();
create trigger organisation_settings_updated_at before update on public.organisation_settings for each row execute function public.set_updated_at();

create or replace function public.enforce_active_user_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  allowed_count integer;
  current_count integer;
begin
  if not new.is_active then return new; end if;
  if tg_op = 'UPDATE' and old.is_active and old.organisation_id = new.organisation_id then return new; end if;

  select active_user_limit into allowed_count
  from public.organisations where id = new.organisation_id for update;

  select count(*) into current_count
  from public.profiles
  where organisation_id = new.organisation_id and is_active
    and (tg_op <> 'UPDATE' or id <> new.id);

  if current_count >= allowed_count then
    raise exception 'Free plan limit reached: maximum 15 active users per organisation';
  end if;
  return new;
end;
$$;

create trigger profiles_active_user_limit
before insert or update of is_active, organisation_id on public.profiles
for each row execute function public.enforce_active_user_limit();

alter publication supabase_realtime add table public.candidates;
alter publication supabase_realtime add table public.candidate_change_requests;

