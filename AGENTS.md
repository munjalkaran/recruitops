# Telora — Codex Instructions

Before doing anything in this repo, read docs/TELORA_MASTER_CONTEXT.md in full. It has the real architecture, security model, feature status, and known limitations — verified against actual code, not assumed.

## Stack

React 18 + Vite 5 + Tailwind 3, pnpm. Supabase (Postgres, Auth, RLS, RPC, Realtime). Netlify hosting, main branch auto-deploys.

## Non-negotiable rules

- Never expose secrets. Only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY belong in VITE_-prefixed env vars.
- Never weaken RLS to make a feature easier to build.
- Don't modify an already-applied migration in supabase/migrations — write a new one.
- Run pnpm install && pnpm test && pnpm build before saying any task is done. Report if any fail.
- For anything beyond a trivial fix, work in a feature branch.
- Always show me a git diff of what changed before pushing. Push to main only after I approve the diff, then confirm the push succeeded.

## Roadmap

Priorities are scoped in docs/COMPETITIVE_GAP_AUDIT.md plus product-owner lifecycle feedback (invoice-on-3-month-completion, lifecycle milestone dates, recruiter salary/leave module). Check there before proposing new priorities.

## Ownership

Karan Munjal (munjalkaran) owns all product and merge decisions.
