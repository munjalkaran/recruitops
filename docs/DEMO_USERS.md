# Demo recruiter users

RecruitOps never creates Supabase Auth passwords from SQL. Create the Auth identities first, then attach their RecruitOps profiles.

1. Open **Supabase Dashboard → Authentication → Users**.
2. Create Priya and Arjun manually and auto-confirm both users.
3. Use real accessible email addresses for actual customer users. For internal demo-only users, the aliases below may be used only when credentials are managed safely by your team.
4. Copy each user's **User UID**. Do not put passwords in this repository.
5. In the SQL Editor, replace the UUID placeholders and run:

```sql
select public.seed_hiring_spartans_profile(
  'PRIYA_AUTH_UUID',
  'Priya Nair',
  'priya@hiringspartans.demo',
  'recruiter'
);

select public.seed_hiring_spartans_profile(
  'ARJUN_AUTH_UUID',
  'Arjun Mehta',
  'arjun@hiringspartans.demo',
  'recruiter'
);
```

The Auth email and profile email should match. The sample seed resolves these exact profile emails and raises a clear error if either active recruiter profile is missing; it never invents UUIDs and never inserts into `auth.users`.

After the Admin, Priya, and Arjun profiles exist, apply the migrations and run the contents of `supabase/seed.sql` in the SQL Editor. A repeat run does not duplicate data: it returns the active batch, or tells you to restore the removed batch.

