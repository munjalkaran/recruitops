create or replace function public.current_profile()
returns public.profiles language sql stable security definer
set search_path = public as $$
  select p from public.profiles p where p.id = auth.uid() and p.is_active limit 1
$$;

create or replace function public.current_organisation_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select (public.current_profile()).organisation_id
$$;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer
set search_path = public as $$
  select (public.current_profile()).role
$$;

revoke all on function public.current_profile() from public;
revoke all on function public.current_organisation_id() from public;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.current_organisation_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_change_requests enable row level security;
alter table public.candidate_audit_log enable row level security;
alter table public.candidate_links enable row level security;
alter table public.organisation_settings enable row level security;

create policy organisations_select_member on public.organisations for select to authenticated
using (id = public.current_organisation_id());

create policy profiles_select_member on public.profiles for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy profiles_update_admin on public.profiles for update to authenticated
using (organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin')
with check (organisation_id = public.current_organisation_id());

create policy candidates_select_scoped on public.candidates for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (public.current_app_role() = 'admin' or owner_id = auth.uid())
);
create policy candidates_update_admin on public.candidates for update to authenticated
using (organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin')
with check (organisation_id = public.current_organisation_id());

create policy change_requests_select_scoped on public.candidate_change_requests for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (public.current_app_role() = 'admin' or requested_by = auth.uid())
);

create policy audit_log_select_scoped on public.candidate_audit_log for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (
    public.current_app_role() = 'admin'
    or exists (select 1 from public.candidates c where c.id = candidate_id and c.owner_id = auth.uid())
  )
);

create policy candidate_links_select_scoped on public.candidate_links for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and exists (select 1 from public.candidates c where c.id = candidate_id)
);

create policy settings_select_member on public.organisation_settings for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy settings_update_admin on public.organisation_settings for update to authenticated
using (organisation_id = public.current_organisation_id() and public.current_app_role() = 'admin')
with check (organisation_id = public.current_organisation_id());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.organisations, public.profiles, public.candidates,
  public.candidate_change_requests, public.candidate_audit_log,
  public.candidate_links, public.organisation_settings to authenticated;
grant update on public.profiles, public.candidates, public.organisation_settings to authenticated;

