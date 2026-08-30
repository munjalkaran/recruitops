# Telora — Master Context

Purpose of this file: permanent handover doc for any AI agent (Claude, ChatGPT, Codex, or future tools) picking up work on this repo. Read this first. If anything here conflicts with the actual code, migrations, or main branch — the repo wins, not this file. Update this file whenever a major decision, rule, or architecture change lands on main.

Last verified against repo state: commit a881f78 ("Release Telora MVP"), main branch, by direct inspection of code/migrations/docs — not from chat history or a prior agent's summary.

---

## 1. What Telora is

Telora is a recruitment pipeline / ATS built for Hiring Spartans, a small Indian staffing agency currently moving off spreadsheets. Tagline: "Talent, tracked with clarity."

It is live in production, single-tenant in practice (one organisation: Hiring Spartans), and used daily by real recruiters and an admin.

## 2. Architecture

- Frontend: React 18 + Vite 5 + Tailwind 3, pnpm package manager (pnpm@11.15.1 pinned).
- Backend: Supabase — Postgres, Auth (email/password only), Row Level Security, RPC functions, Realtime on candidates/approvals.
- Hosting: Netlify. Build: pnpm build → publish dist. SPA fallback redirect to index.html (in netlify.toml).
- Repo: munjalkaran/recruitops, production branch main. Public on GitHub.
- No backend server of its own — all logic is either in the browser bundle or in Supabase RPC/SQL functions. There is no Node/Express API layer.

### Environment variables (Netlify + local)

Only these two belong in the browser bundle: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

VITE_ENABLE_DEMO_MODE is local-only mock mode — never set in Netlify production. No service-role key, OpenAI key, or email-provider secret has ever been in this repo (verified: .env.example only has the two anon-safe vars). Keep it that way — anything prefixed VITE_ ships to the browser.

## 3. Roles and security model

Two roles: admin, recruiter.

- RLS is the real security boundary — not the UI. Admins read all organisation candidates; recruiters read only candidates where owner_id = their own auth UUID.
- Recruiters can only touch operational fields (stage, notes, follow-up dates, doc status) via the update_candidate_operations RPC. Anything sensitive (phone, email, employer, fee, owner) requires submitting a correction request that an admin approves/rejects.
- Archive, restore, permanent delete, and candidate creation are all RPC-gated, not direct table writes.
- Free-plan tier enforced in the database, not just in marketing copy: max 15 active users per organisation (active_user_limit check constraint + a raised exception in initial_schema.sql). If Hiring Spartans ever needs a 16th active seat, this constraint has to change first — it's not a UI limit you can route around.

## 4. Current feature state (verified in code, not assumed)

| Feature | Status |
|---|---|
| Candidate pipeline, search/filter | Live |
| Vacancies | Live |
| Interviews (scheduling, panel, feedback, no-show, reschedule) | Live |
| Scorecards | Live |
| Activity timeline | Live |
| Invoicing (CSV export, mark-invoiced, bank/NBFC grouping) | Live |
| PDF invoice | Live |
| CSV candidate import/export | Live |
| Sample/demo data (seed + reversible remove/restore) | Live — 19 seeded records, admin-only, RPC-gated |
| "Ask Telora" AI panel | Live but not actually AI — see below |
| Retention tracking fields (retention period, due date, replacement guarantee) | Schema exists, not wired into invoice eligibility yet — comment in migration explicitly says "Retention fields are informational only; current invoice eligibility remains Joined." |
| Gmail/Outlook integration | Not built — manual "copy email draft" flow only |
| WhatsApp/SMS | Not built |
| Resume parsing | Not built |
| Real LLM-backed AI ranking/matching | Not built |

### Important correction: "Ask Telora" is not AI

src/services/askRecruitOpsService.js is a deterministic regex/keyword matcher over already-loaded, RLS-scoped data (interviews, candidates, vacancies). There is no LLM call — no OpenAI/Anthropic/any SDK in package.json. It's safe (no hallucination, no data leak risk) but it is not what "AI-powered" usually implies to a customer. docs/ASK_AI_EDGE_FUNCTION.md documents a planned contract for a future Supabase Edge Function that could add real model-backed answers without changing the panel's request/response shape — but that function does not exist yet. If Hiring Spartans has been told this is AI-powered, know that it's currently rule-based, not model-based.

## 5. Business rules worth knowing before you touch anything

- Stale/returning candidate rule: re-application by a previously archived candidate triggers a warning that opens the archived record (referenced as "the returning Rohit warning" in the deploy checklist) rather than silently creating a duplicate.
- Sample data isolation: seeded/demo candidates are flagged is_demo, go through the same authenticated RLS-protected paths as real data, and cannot be permanently deleted through the normal candidate-delete RPC — only through the explicit "Remove demo data" flow (requires typing REMOVE SAMPLE DATA to confirm). Real candidate data is never touched by this.
- Invoicing only fires on Joined status today. Retention/replacement-guarantee tracking exists in the schema for future use but currently has zero effect on when something becomes invoice-eligible.
- 10 migrations applied, timestamp-ordered, none reverted or hand-edited after the fact (per the docs/MVP_DEPLOYMENT.md deploy discipline). Don't hand-edit an already-applied migration — add a new one.

## 6. Known limitations (real, not the AI-generated placeholder list from before)

- No production LLM backend — "Ask Telora" is rules-based only.
- No email/WhatsApp provider integration — manual draft-and-copy only.
- Retention rules are tracked but don't affect invoicing yet.
- Single organisation in practice (Hiring Spartans); multi-tenant behaviour exists in schema (organisation_id scoping) but has only ever been exercised by one tenant.
- Free-plan 15-user cap is a hard DB constraint, not a soft UI warning.

## 7. Existing internal roadmap

docs/COMPETITIVE_GAP_AUDIT.md already has a prioritised P0–P3 list (protect trust/ops → beat the spreadsheet → reduce coordination effort → defer until usage proves the need). Read that before proposing new priorities — don't re-derive a roadmap that already exists in the repo.

## 8. Rules for any agent working on this repo

- Never expose secrets. Nothing but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY goes into VITE_-prefixed env vars.
- Never weaken RLS to make a feature easier to build.
- Don't modify an already-applied migration — write a new one.
- Work in a feature branch → review → merge to main. main auto-deploys to Netlify via the connected repo.
- Run pnpm install && pnpm test && pnpm build before calling anything done.
- Before making changes: pull main, check git log for anything since this file was last updated, and re-verify any claim in this document that matters for the task at hand. This file is a starting point, not a source of truth that overrides the live repo.

## 9. Ownership

Repo owner / product decision-maker: Karan Munjal (munjalkaran). Client-facing accountability, roadmap calls, and what ships are his to decide — an agent proposes, it doesn't merge to main unasked.
