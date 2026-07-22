insert into public.organisations (id, name, slug, plan_code, active_user_limit)
values ('11111111-1111-4111-8111-111111111111', 'Hiring Spartans', 'hiring-spartans', 'free', 15)
on conflict (id) do nothing;

insert into public.organisation_settings (organisation_id, display_name, email_signature)
values ('11111111-1111-4111-8111-111111111111', 'Hiring Spartans', 'Hiring Spartans Recruitment Team')
on conflict (organisation_id) do nothing;

create or replace function public.seed_hiring_spartans_profile(
  p_user_id uuid, p_full_name text, p_email text, p_role public.app_role default 'recruiter'
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Create the Auth user first'; end if;
  insert into public.profiles(id,organisation_id,full_name,email,role)
  values(p_user_id,'11111111-1111-4111-8111-111111111111',p_full_name,p_email,p_role)
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,role=excluded.role
  returning * into result;
  return result;
end;
$$;

revoke all on function public.seed_hiring_spartans_profile(uuid,text,text,public.app_role) from public, anon, authenticated;

