-- Reversible, organisation-scoped sample data support for RecruitOps.
-- Existing migrations remain unchanged; this migration is safe to apply once with `supabase db push`.

alter table public.candidates
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_batch_id uuid,
  add column if not exists demo_removed_at timestamptz,
  add column if not exists demo_removed_by uuid references public.profiles(id) on delete set null;

create table if not exists public.demo_data_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  removed_by uuid references public.profiles(id) on delete set null,
  removed_at timestamptz,
  restored_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'candidates_demo_batch_id_fkey'
      and conrelid = 'public.candidates'::regclass
  ) then
    alter table public.candidates
      add constraint candidates_demo_batch_id_fkey
      foreign key (demo_batch_id) references public.demo_data_batches(id) on delete restrict;
  end if;
end;
$$;

create index if not exists candidates_organisation_idx on public.candidates (organisation_id);
create index if not exists candidates_is_demo_idx on public.candidates (is_demo);
create index if not exists candidates_demo_batch_idx on public.candidates (demo_batch_id);
create index if not exists candidates_demo_removed_at_idx on public.candidates (demo_removed_at);
create index if not exists candidates_phone_idx on public.candidates (phone);
create index if not exists candidates_email_idx on public.candidates (email);
create index if not exists candidates_owner_idx on public.candidates (owner_id);
create index if not exists candidates_stage_idx on public.candidates (stage);
create index if not exists candidates_is_archived_idx on public.candidates (is_archived);
create index if not exists demo_data_batches_organisation_idx
  on public.demo_data_batches (organisation_id, created_at desc);
create unique index if not exists demo_data_batches_one_active_per_org_idx
  on public.demo_data_batches (organisation_id) where status = 'active';

alter table public.demo_data_batches enable row level security;

drop policy if exists demo_data_batches_select_admin on public.demo_data_batches;
create policy demo_data_batches_select_admin on public.demo_data_batches for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.current_app_role() = 'admin'
);

-- Removed samples are invisible at the database boundary. Admins can inspect batch
-- metadata, but candidate rows only return after an explicit restore RPC.
drop policy if exists candidates_select_scoped on public.candidates;
create policy candidates_select_scoped on public.candidates for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and demo_removed_at is null
  and (public.current_app_role() = 'admin' or owner_id = auth.uid())
);

drop policy if exists candidates_update_admin on public.candidates;
create policy candidates_update_admin on public.candidates for update to authenticated
using (
  organisation_id = public.current_organisation_id()
  and demo_removed_at is null
  and public.current_app_role() = 'admin'
)
with check (
  organisation_id = public.current_organisation_id()
  and demo_removed_at is null
);

drop policy if exists change_requests_select_scoped on public.candidate_change_requests;
create policy change_requests_select_scoped on public.candidate_change_requests for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (public.current_app_role() = 'admin' or requested_by = auth.uid())
  and exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.demo_removed_at is null
  )
);

drop policy if exists candidate_links_select_scoped on public.candidate_links;
create policy candidate_links_select_scoped on public.candidate_links for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.demo_removed_at is null
  )
  and exists (
    select 1 from public.candidates linked
    where linked.id = linked_candidate_id and linked.demo_removed_at is null
  )
);

revoke all on public.demo_data_batches from anon, authenticated;
grant select on public.demo_data_batches to authenticated;

create or replace function public.remove_demo_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  changed record;
  removed_count integer := 0;
  removed_timestamp timestamptz := clock_timestamp();
begin
  actor := public.assert_admin();

  for changed in
    update public.candidates c
    set demo_removed_at = removed_timestamp,
        demo_removed_by = actor.id
    where c.organisation_id = actor.organisation_id
      and c.is_demo
      and c.demo_removed_at is null
      and exists (
        select 1 from public.demo_data_batches b
        where b.id = c.demo_batch_id
          and b.organisation_id = actor.organisation_id
          and b.status = 'active'
      )
    returning c.id, c.demo_batch_id
  loop
    removed_count := removed_count + 1;
    insert into public.candidate_audit_log (
      organisation_id, candidate_id, actor_id, action, changed_fields
    ) values (
      actor.organisation_id,
      changed.id,
      actor.id,
      'demo_data_removed',
      jsonb_build_object('demo_batch_id', changed.demo_batch_id, 'removed_at', removed_timestamp)
    );
  end loop;

  update public.demo_data_batches
  set status = 'removed',
      removed_by = actor.id,
      removed_at = removed_timestamp
  where organisation_id = actor.organisation_id
    and status = 'active';

  return removed_count;
end;
$$;

create or replace function public.restore_demo_data(p_demo_batch_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  target_batch public.demo_data_batches;
  changed record;
  restored_count integer := 0;
  restored_timestamp timestamptz := clock_timestamp();
begin
  actor := public.assert_admin();

  if p_demo_batch_id is null then
    select * into target_batch
    from public.demo_data_batches
    where organisation_id = actor.organisation_id and status = 'removed'
    order by removed_at desc nulls last, created_at desc
    limit 1
    for update;
  else
    select * into target_batch
    from public.demo_data_batches
    where id = p_demo_batch_id
      and organisation_id = actor.organisation_id
      and status = 'removed'
    for update;
  end if;

  if target_batch.id is null then
    raise exception 'No removed sample data batch was found for this organisation';
  end if;
  if exists (
    select 1 from public.demo_data_batches
    where organisation_id = actor.organisation_id and status = 'active'
  ) then
    raise exception 'Active sample data already exists for this organisation';
  end if;

  for changed in
    update public.candidates
    set demo_removed_at = null,
        demo_removed_by = null
    where organisation_id = actor.organisation_id
      and is_demo
      and demo_batch_id = target_batch.id
      and demo_removed_at is not null
    returning id
  loop
    restored_count := restored_count + 1;
    insert into public.candidate_audit_log (
      organisation_id, candidate_id, actor_id, action, changed_fields
    ) values (
      actor.organisation_id,
      changed.id,
      actor.id,
      'demo_data_restored',
      jsonb_build_object('demo_batch_id', target_batch.id, 'restored_at', restored_timestamp)
    );
  end loop;

  update public.demo_data_batches
  set status = 'active',
      restored_by = actor.id,
      restored_at = restored_timestamp
  where id = target_batch.id;

  return restored_count;
end;
$$;

create or replace function public.seed_demo_data_for_current_organisation()
returns table (batch_id uuid, inserted_count integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles;
  priya_id uuid;
  arjun_id uuid;
  new_batch_id uuid;
  existing_batch public.demo_data_batches;
  inserted_total integer := 0;
  current_candidate record;
  new_rohit_id uuid;
  old_rohit_id uuid;
begin
  actor := public.assert_admin();
  perform pg_advisory_xact_lock(hashtext(actor.organisation_id::text));

  select * into existing_batch
  from public.demo_data_batches
  where organisation_id = actor.organisation_id and status = 'active'
  order by created_at desc limit 1;
  if existing_batch.id is not null then
    return query select existing_batch.id, 0, 'Active sample data already exists; no duplicates were created'::text;
    return;
  end if;

  select * into existing_batch
  from public.demo_data_batches
  where organisation_id = actor.organisation_id and status = 'removed'
  order by removed_at desc nulls last, created_at desc limit 1;
  if existing_batch.id is not null then
    return query select existing_batch.id, 0, 'Sample data is removed; restore the existing batch instead of creating a duplicate'::text;
    return;
  end if;

  select id into priya_id from public.profiles
  where organisation_id = actor.organisation_id
    and lower(email) = 'priya@hiringspartans.demo'
    and role = 'recruiter' and is_active
  limit 1;
  select id into arjun_id from public.profiles
  where organisation_id = actor.organisation_id
    and lower(email) = 'arjun@hiringspartans.demo'
    and role = 'recruiter' and is_active
  limit 1;

  if priya_id is null or arjun_id is null then
    raise exception 'Create active recruiter profiles for priya@hiringspartans.demo and arjun@hiringspartans.demo before seeding sample data';
  end if;

  insert into public.demo_data_batches (organisation_id, name, created_by)
  values (actor.organisation_id, 'Hiring Spartans MVP sample dataset', actor.id)
  returning id into new_batch_id;

  insert into public.candidates (
    organisation_id, name, phone, email, current_employer, experience_years,
    target_bank, role, stage, owner_id, docs_status, fee, next_follow_up,
    last_contact, notes, is_archived, archived_at, archived_by, created_by,
    created_at, updated_at, is_demo, demo_batch_id
  ) values
    (actor.organisation_id,'Rohit Sharma','9000000001','rohit.sharma.demo@example.com','ICICI Bank',5.5,'HDFC Bank','Relationship Manager','Sourced',priya_id,'Partial',40000,current_date-interval '5 days',current_date-interval '8 days','Returning candidate; employment update awaiting approval.',false,null,null,actor.id,now()-interval '12 days',now()-interval '2 days',true,new_batch_id),
    (actor.organisation_id,'Anjali Verma','9000000002','anjali.verma.demo@example.com','Axis Bank',3.0,'Kotak Mahindra Bank','Branch Sales Officer','Sourced',arjun_id,'Pending',30000,current_date-interval '3 days',current_date-interval '7 days','Phone correction awaiting approval.',false,null,null,actor.id,now()-interval '10 days',now()-interval '3 days',true,new_batch_id),
    (actor.organisation_id,'Kavya Reddy','9000000003','kavya.reddy.demo@example.com','HDFC Bank',4.0,'ICICI Bank','Credit Analyst','Sourced',null,'Pending',45000,current_date+interval '3 days',current_date-interval '1 day','Unassigned sample lead for Admin triage.',false,null,null,actor.id,now()-interval '4 days',now()-interval '1 day',true,new_batch_id),
    (actor.organisation_id,'Imran Khan','9000000004','imran.khan.demo@example.com','Bajaj Finance',2.5,'IDFC First Bank','Loan Officer','Contacted',priya_id,'Partial',35000,current_date-interval '4 days',current_date-interval '6 days','Interested; follow up on preferred location.',false,null,null,actor.id,now()-interval '9 days',now()-interval '4 days',true,new_batch_id),
    (actor.organisation_id,'Neha Gupta','9000000005','neha.gupta.demo@example.com','Kotak Mahindra Bank',6.0,'Axis Bank','Operations Executive','Contacted',arjun_id,'Pending',40000,current_date+interval '1 day',current_date,'Initial conversation completed.',false,null,null,actor.id,now()-interval '8 days',now(),true,new_batch_id),
    (actor.organisation_id,'Deepak Rao','9000000006','deepak.rao.demo@example.com','Shriram Finance',7.0,'HDFC Bank','Collections Executive','Screened',priya_id,'Complete',50000,current_date-interval '2 days',current_date-interval '5 days','Strong collections background.',false,null,null,actor.id,now()-interval '15 days',now()-interval '2 days',true,new_batch_id),
    (actor.organisation_id,'Sneha Iyer','9000000007','sneha.iyer.demo@example.com','IDFC First Bank',4.5,'ICICI Bank','Customer Service Officer','Screened',arjun_id,'Partial',35000,current_date+interval '2 days',current_date-interval '1 day','Screening notes shared with hiring manager.',false,null,null,actor.id,now()-interval '13 days',now()-interval '1 day',true,new_batch_id),
    (actor.organisation_id,'Vikram Singh','9000000008','vikram.singh.demo@example.com','Axis Bank',8.0,'Kotak Mahindra Bank','Relationship Manager','Interviewing',priya_id,'Complete',50000,current_date+interval '4 days',current_date,'First interview completed.',false,null,null,actor.id,now()-interval '18 days',now(),true,new_batch_id),
    (actor.organisation_id,'Pooja Desai','9000000009','pooja.desai.demo@example.com','HDFC Bank',3.5,'Bajaj Finance','Credit Analyst','Interviewing',arjun_id,'Partial',45000,current_date+interval '5 days',current_date-interval '2 days','Panel interview scheduled.',false,null,null,actor.id,now()-interval '17 days',now()-interval '2 days',true,new_batch_id),
    (actor.organisation_id,'Arun Kumar','9000000010','arun.kumar.demo@example.com','ICICI Bank',5.0,'Axis Bank','Loan Officer','Selected',priya_id,'Partial',40000,current_date+interval '2 days',current_date-interval '1 day','Offer discussion in progress.',false,null,null,actor.id,now()-interval '21 days',now()-interval '1 day',true,new_batch_id),
    (actor.organisation_id,'Fatima Sheikh','9000000011','fatima.sheikh.demo@example.com','Bajaj Finance',4.0,'Shriram Finance','Collections Executive','Selected',arjun_id,'Complete',35000,current_date+interval '3 days',current_date,'Selection confirmed by client.',false,null,null,actor.id,now()-interval '20 days',now(),true,new_batch_id),
    (actor.organisation_id,'Manish Patel','9000000012','manish.patel.demo@example.com','Kotak Mahindra Bank',6.5,'HDFC Bank','Operations Executive','Documentation',priya_id,'Partial',45000,current_date+interval '1 day',current_date-interval '2 days','Awaiting address proof.',false,null,null,actor.id,now()-interval '24 days',now()-interval '2 days',true,new_batch_id),
    (actor.organisation_id,'Lakshmi Menon','9000000013','lakshmi.menon.demo@example.com','IDFC First Bank',2.0,'ICICI Bank','Teller','Documentation',arjun_id,'Partial',25000,current_date+interval '2 days',current_date-interval '1 day','Education documents pending.',false,null,null,actor.id,now()-interval '23 days',now()-interval '1 day',true,new_batch_id),
    (actor.organisation_id,'Sameer Joshi','9000000014','sameer.joshi.demo@example.com','Axis Bank',5.0,'HDFC Bank','Relationship Manager','Joined',priya_id,'Complete',50000,null,current_date-interval '3 days','Joined successfully; ready for invoicing.',false,null,null,actor.id,now()-interval '35 days',now()-interval '3 days',true,new_batch_id),
    (actor.organisation_id,'Ritu Agarwal','9000000015','ritu.agarwal.demo@example.com','HDFC Bank',4.5,'Kotak Mahindra Bank','Branch Sales Officer','Joined',arjun_id,'Complete',40000,null,current_date-interval '4 days','Joining confirmed by client.',false,null,null,actor.id,now()-interval '32 days',now()-interval '4 days',true,new_batch_id),
    (actor.organisation_id,'Nikhil Bansal','9000000016','shared-contact.demo@example.com','Bajaj Finance',3.5,'IDFC First Bank','Loan Officer','Joined',null,'Complete',35000,null,current_date-interval '2 days','Unassigned joined record; Admin invoice example.',false,null,null,actor.id,now()-interval '30 days',now()-interval '2 days',true,new_batch_id),
    (actor.organisation_id,'Meera Shah','9000000017','shared-contact.demo@example.com','ICICI Bank',7.0,'Axis Bank','Credit Analyst','Invoiced',priya_id,'Complete',50000,null,current_date-interval '12 days','Invoice example; shares a sample email for duplicate detection.',false,null,null,actor.id,now()-interval '45 days',now()-interval '12 days',true,new_batch_id),
    (actor.organisation_id,'Aditya Menon','9000000018','aditya.menon.demo@example.com','Shriram Finance',2.5,'Bajaj Finance','Customer Service Officer','Dropped',arjun_id,'Pending',30000,null,current_date-interval '9 days','Candidate withdrew due to relocation.',false,null,null,actor.id,now()-interval '28 days',now()-interval '9 days',true,new_batch_id),
    (actor.organisation_id,'Rohit Sharma','9000000001','rohit.previous.demo@example.com','HDFC Bank',4.5,'Axis Bank','Branch Sales Officer','Dropped',priya_id,'Partial',30000,null,current_date-interval '6 months','Older application retained for returning-candidate history.',true,now()-interval '6 months',actor.id,actor.id,now()-interval '7 months',now()-interval '6 months',true,new_batch_id);

  get diagnostics inserted_total = row_count;

  select id into new_rohit_id from public.candidates
  where demo_batch_id = new_batch_id and name = 'Rohit Sharma' and not is_archived limit 1;
  select id into old_rohit_id from public.candidates
  where demo_batch_id = new_batch_id and name = 'Rohit Sharma' and is_archived limit 1;

  insert into public.candidate_links (
    organisation_id, candidate_id, linked_candidate_id, link_type, created_by
  ) values (
    actor.organisation_id, new_rohit_id, old_rohit_id, 'returning_candidate', actor.id
  ) on conflict (candidate_id, linked_candidate_id) do nothing;

  insert into public.candidate_change_requests (
    organisation_id, candidate_id, requested_by, field_name, old_value,
    proposed_value, reason, status
  ) values
    (actor.organisation_id,new_rohit_id,priya_id,'current_employer',to_jsonb('ICICI Bank'::text),to_jsonb('Axis Bank'::text),'Candidate shared updated employment information','pending'),
    (actor.organisation_id,
      (select id from public.candidates where demo_batch_id=new_batch_id and name='Anjali Verma' limit 1),
      arjun_id,'phone',to_jsonb('9000000002'::text),to_jsonb('9000000092'::text),'Candidate provided corrected contact number','pending');

  insert into public.candidate_audit_log (
    organisation_id, candidate_id, actor_id, action, changed_fields, new_record
  )
  select actor.organisation_id, c.id, actor.id, 'demo_data_created',
    jsonb_build_object('demo_batch_id', new_batch_id), to_jsonb(c)
  from public.candidates c where c.demo_batch_id = new_batch_id;

  insert into public.candidate_audit_log (
    organisation_id, candidate_id, actor_id, action, changed_fields
  ) values (
    actor.organisation_id, null, actor.id, 'demo_batch_created',
    jsonb_build_object('demo_batch_id', new_batch_id, 'candidate_count', inserted_total)
  );

  return query select new_batch_id, inserted_total, 'Sample data created'::text;
end;
$$;

create or replace function public.get_demo_data_status()
returns table (
  batch_id uuid,
  status text,
  candidate_count bigint,
  created_at timestamptz,
  removed_at timestamptz,
  restored_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor public.profiles;
begin
  actor := public.assert_admin();
  return query
  select b.id, b.status, count(c.id), b.created_at, b.removed_at, b.restored_at
  from public.demo_data_batches b
  left join public.candidates c
    on c.demo_batch_id = b.id
    and c.organisation_id = actor.organisation_id
    and c.is_demo
  where b.organisation_id = actor.organisation_id
  group by b.id, b.status, b.created_at, b.removed_at, b.restored_at
  order by b.created_at desc
  limit 1;
end;
$$;

-- Sample candidates are always recoverable through the batch restore flow and
-- can never be physically removed through the ordinary permanent-delete RPC.
create or replace function public.permanently_delete_candidate(p_candidate_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = public as $$
declare actor public.profiles; old_row public.candidates;
begin
  actor := public.assert_admin();
  if p_confirmation <> 'PERMANENTLY DELETE' then raise exception 'Confirmation phrase does not match'; end if;
  select * into old_row from public.candidates
  where id=p_candidate_id
    and organisation_id=actor.organisation_id
    and is_archived
  for update;
  if old_row.id is null then raise exception 'Archived candidate not found'; end if;
  if old_row.is_demo then
    raise exception 'Sample candidates cannot be permanently deleted; use Remove sample data instead';
  end if;
  delete from public.candidate_audit_log where candidate_id=p_candidate_id;
  delete from public.candidates where id=p_candidate_id;
  insert into public.candidate_audit_log(organisation_id,candidate_id,actor_id,action,changed_fields)
  values(actor.organisation_id,null,actor.id,'permanently_deleted',jsonb_build_object('candidate_id',p_candidate_id));
end;
$$;

-- Removed demo rows cannot be mutated by recruiter RPCs even if an old UUID was cached.
create or replace function public.prevent_removed_demo_candidate_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_demo and old.demo_removed_at is not null then
    if tg_op = 'DELETE' then
      raise exception 'Removed sample candidates cannot be permanently deleted';
    end if;
    if public.current_app_role() <> 'admin'
      or new.demo_removed_at is not null
      or (to_jsonb(new) - array['demo_removed_at','demo_removed_by','updated_at'])
         is distinct from
         (to_jsonb(old) - array['demo_removed_at','demo_removed_by','updated_at']) then
      raise exception 'Removed sample candidates can only be restored through restore_demo_data';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists candidates_protect_removed_demo on public.candidates;
create trigger candidates_protect_removed_demo
before update or delete on public.candidates
for each row execute function public.prevent_removed_demo_candidate_mutation();

create or replace function public.prevent_removed_demo_reference_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_candidate_id uuid;
  second_candidate_id uuid;
begin
  if tg_table_name = 'candidate_change_requests' then
    first_candidate_id := new.candidate_id;
  elsif tg_table_name = 'candidate_links' then
    first_candidate_id := new.candidate_id;
    second_candidate_id := new.linked_candidate_id;
  elsif tg_table_name = 'candidate_audit_log' then
    first_candidate_id := new.candidate_id;
    if new.action in ('demo_data_removed', 'demo_data_restored') then return new; end if;
  end if;

  if exists (
    select 1 from public.candidates
    where id in (first_candidate_id, second_candidate_id)
      and is_demo and demo_removed_at is not null
  ) then
    raise exception 'Removed sample candidates cannot be used by normal workflows';
  end if;
  return new;
end;
$$;

drop trigger if exists change_requests_protect_removed_demo on public.candidate_change_requests;
create trigger change_requests_protect_removed_demo
before insert or update on public.candidate_change_requests
for each row execute function public.prevent_removed_demo_reference_mutation();

drop trigger if exists candidate_links_protect_removed_demo on public.candidate_links;
create trigger candidate_links_protect_removed_demo
before insert or update on public.candidate_links
for each row execute function public.prevent_removed_demo_reference_mutation();

drop trigger if exists audit_log_protect_removed_demo on public.candidate_audit_log;
create trigger audit_log_protect_removed_demo
before insert or update on public.candidate_audit_log
for each row execute function public.prevent_removed_demo_reference_mutation();

revoke all on function public.remove_demo_data() from public, anon, authenticated;
revoke all on function public.restore_demo_data(uuid) from public, anon, authenticated;
revoke all on function public.seed_demo_data_for_current_organisation() from public, anon, authenticated;
revoke all on function public.get_demo_data_status() from public, anon, authenticated;
revoke all on function public.prevent_removed_demo_candidate_mutation() from public, anon, authenticated;
revoke all on function public.prevent_removed_demo_reference_mutation() from public, anon, authenticated;
grant execute on function public.remove_demo_data() to authenticated;
grant execute on function public.restore_demo_data(uuid) to authenticated;
grant execute on function public.seed_demo_data_for_current_organisation() to authenticated;
grant execute on function public.get_demo_data_status() to authenticated;
