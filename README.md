# RecruitOps

RecruitOps is Hiring Spartans' recruitment pipeline: **From candidate to payment, all in one place**. The existing React, Vite, and Tailwind interface is backed by Supabase Postgres, Auth, Row Level Security (RLS), RPC functions, and Realtime.

## Supabase setup

1. Create a new project at [Supabase](https://supabase.com/dashboard). In **Authentication → Providers**, keep Email enabled. Set the Site URL to the local or production frontend URL and add both URLs to the redirect allow list.
2. Install the Supabase CLI, sign in, and link the repository to the project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF¯
   supabase db push
   ```

   `supabase db push` applies the versioned migrations in `supabase/migrations` in timestamp order. They create the schema, RLS policies, secure RPC functions, default Hiring Spartans organisation, free-plan 15-active-user enforcement, and reversible sample-data support.
3. In **Authentication → Users**, create the Admin and recruiter email/password users. Copy each user's UUID.
4. In the Supabase SQL editor, insert the matching profile for each Auth UUID. The helper is intentionally unavailable to browser clients:

   ```sql
   select public.seed_hiring_spartans_profile(
     'AUTH-USER-UUID',
     'Admin Owner',
     'admin@example.com',
     'admin'
   );

   select public.seed_hiring_spartans_profile(
     'AUTH-USER-UUID',
     'Recruiter Name',
     'recruiter@example.com',
     'recruiter'
   );
   ```

   Valid roles are `admin` and `recruiter`. The Auth user UUID and `profiles.id` must match. The database rejects a 16th active user in a free-plan organisation.

## Local development

Copy `.env.example` to `.env.local` and add the project's browser-safe API values from **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_ENABLE_DEMO_MODE=false
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, OpenAI keys, or email-provider secrets in a `VITE_` variable. Any `VITE_` value is bundled into the browser app.

Install and run:

```sh
pnpm install
pnpm dev
```

`VITE_ENABLE_DEMO_MODE` is only the optional local mock mode. Production sample data is stored in Supabase, marked with `is_demo`, and uses the same authenticated/RLS-protected workflows as real candidates. Do not set `VITE_ENABLE_DEMO_MODE` in Netlify.

## Supabase sample data

1. Create and auto-confirm the Priya and Arjun Auth users, then create their profiles using [docs/DEMO_USERS.md](docs/DEMO_USERS.md). Never insert users into `auth.users` or commit passwords.
2. Apply migrations with `supabase db push`.
3. Run `supabase/seed.sql` in the Supabase SQL Editor. It finds existing profiles by email and creates one idempotent sample batch.

The seed creates 19 records: 18 active pipeline examples and one archived historical Rohit application. Admins can soft-remove the entire batch from the banner or Settings and restore that exact batch later. Real candidates are never changed, and sample candidates cannot be permanently deleted through the ordinary candidate-delete RPC.

## Security model

- RLS is the security boundary. Admins can read all organisation candidates; recruiters can read only candidates assigned to their Auth UUID.
- Recruiters update only operational fields through `update_candidate_operations`: stage, document status, next follow-up, last contact, and notes.
- Protected changes are submitted and reviewed through RPCs. Archive, restore, permanent delete, owner assignment, and candidate creation are also RPC-controlled.
- Admin-only navigation is mirrored by database checks; hiding a UI control is never relied on for security.
- Candidate and approval tables are enabled for Supabase Realtime while every event remains subject to RLS.

## Netlify deployment

1. Connect this repository to a Netlify site.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Site configuration → Environment variables**. Do not add `VITE_ENABLE_DEMO_MODE` in production.
3. Use the committed `netlify.toml`: build command `pnpm build`, publish directory `dist`, and the SPA fallback redirect to `index.html`.
4. Netlify detects pnpm from `pnpm-lock.yaml` and the committed `packageManager: pnpm@11.15.1` field.
5. Add the Netlify production URL to Supabase Auth's Site URL and redirect allow list, then deploy.

See [docs/MVP_DEPLOYMENT.md](docs/MVP_DEPLOYMENT.md) for the complete release checklist and [docs/CUSTOMER_QUICK_START.md](docs/CUSTOMER_QUICK_START.md) for the customer handoff.

Validate a release locally with:

```sh
pnpm install
pnpm build
```
