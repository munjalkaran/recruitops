# Telora MVP deployment

## 1. Prepare Supabase

1. Link the intended Supabase project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

2. Keep Email authentication enabled. Configure the local URL and final Netlify URL in **Authentication → URL Configuration** as the Site URL/allowed redirects.
3. Create the Admin and the two recruiter Auth users. Follow `docs/DEMO_USERS.md` for Priya and Arjun.
4. Run `supabase/seed.sql` in the SQL Editor. The script uses an existing active Hiring Spartans Admin for that transaction and calls the same admin-only, organisation-scoped seed RPC.

## 2. Validate locally

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_ENABLE_DEMO_MODE=false
```

Only the browser-safe project URL and anon key belong in `VITE_` variables. Never add a service-role key, Auth password, OpenAI key, or email-provider secret.

```sh
pnpm install
pnpm test
pnpm build
pnpm preview
```

Verify an Admin sees all active candidates, Priya and Arjun see only their assignments, approvals are scoped correctly, the returning Rohit warning opens the archived record, and remove/restore leaves any real candidate untouched.

## 3. Deploy to Netlify

The committed `netlify.toml` contains:

- Build command: `pnpm build`
- Publish directory: `dist`
- SPA fallback: `/*` → `/index.html` with status `200`

Netlify can select pnpm from `pnpm-lock.yaml` and `package.json` (`packageManager: pnpm@11.15.1`). In **Site configuration → Environment variables**, add only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not set `VITE_ENABLE_DEMO_MODE` in production. The production sample dataset lives in Supabase and is reached through ordinary authenticated access, RLS, and secure RPCs.

After the first deploy, add the exact HTTPS Netlify URL to Supabase Auth URL configuration, redeploy if environment values changed, and smoke-test Admin plus both recruiter accounts.

## 4. Customer handoff

Give the customer `docs/CUSTOMER_QUICK_START.md`. Before real candidate entry, the Admin may either keep samples for guided exploration or choose **Remove demo data**. Removal is reversible from Settings.
