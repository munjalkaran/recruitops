-- RecruitOps sample dataset bootstrap.
-- Run after creating the Admin, Priya, and Arjun Auth users and matching profiles.
-- This script does not create Auth users or passwords. It temporarily assumes the
-- first active Hiring Spartans Admin only for this SQL Editor transaction.

begin;

do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from public.profiles
  where organisation_id = '11111111-1111-4111-8111-111111111111'
    and role = 'admin'
    and is_active
  order by created_at
  limit 1;

  if admin_id is null then
    raise exception 'Create an active Hiring Spartans Admin profile before running supabase/seed.sql';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select * from public.seed_demo_data_for_current_organisation();

commit;
