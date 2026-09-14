# Telora — Master Context

Purpose of this file: permanent handover doc for any AI agent (Claude, ChatGPT, Codex, or future tools) picking up work on this repo. Read this first. If anything here conflicts with the actual code, migrations, or main branch — the repo wins, not this file. Update this file whenever a major decision, rule, or architecture change lands on main.

Last verified against repo state: commit 0562136 ("Add pipeline grid sorting and filters"), main branch, by direct inspection of code/migrations/docs — not from chat history or a prior agent's summary.

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
- Recruiters can only touch core operational fields (stage, notes, follow-up dates, last contact, actual joining date, doc status) via the update_candidate_operations RPC, plus workflow extension fields through the profile-extension RPC when they own the candidate. Anything sensitive (phone, email, employer, fee, owner) requires submitting a correction request that an admin approves/rejects.
- Archive, restore, permanent delete, and candidate creation are all RPC-gated, not direct table writes.
- Free-plan tier enforced in the database, not just in marketing copy: max 15 active users per organisation (active_user_limit check constraint + a raised exception in initial_schema.sql). If Hiring Spartans ever needs a 16th active seat, this constraint has to change first — it's not a UI limit you can route around.

## 4. Current feature state (verified in code, not assumed)

| Feature | Status |
|---|---|
| Candidate pipeline, search/filter | Live — per-column type-aware sorting and per-column filters |
| Actual joining date in pipeline grid | Live — editable inline for permitted users; recruiters update it through update_candidate_operations |
| Vacancies | Live |
| Interviews (scheduling, panel, feedback, no-show, reschedule) | Live |
| Scorecards | Live |
| Activity timeline | Live |
| Invoicing (CSV export, mark-invoiced, bank/NBFC grouping) | Live — eligibility is Joined + active + actual joining date + day-90 rule + billable retention status |
| PDF invoice | Live |
| CSV candidate import/export | Live |
| Sample/demo data (seed + reversible remove/restore) | Live — 19 seeded records, admin-only, RPC-gated |
| "Ask Telora" AI panel | Live but not actually AI — see below |
| Retention tracking fields (retention period, due date, replacement guarantee) | Schema/UI exists; retention_status now affects invoice eligibility by excluding Failed and Replacement Required, but retention_* and invoice_eligibility_date permissions still need tightening |
| Gmail/Outlook integration | Not built — manual "copy email draft" flow only |
| WhatsApp/SMS | Not built |
| Resume parsing | Not built |
| Real LLM-backed AI ranking/matching | Not built |

### Important correction: "Ask Telora" is not AI

src/services/askRecruitOpsService.js is a deterministic regex/keyword matcher over already-loaded, RLS-scoped data (interviews, candidates, vacancies). There is no LLM call — no OpenAI/Anthropic/any SDK in package.json. It's safe (no hallucination, no data leak risk) but it is not what "AI-powered" usually implies to a customer. docs/ASK_AI_EDGE_FUNCTION.md documents a planned contract for a future Supabase Edge Function that could add real model-backed answers without changing the panel's request/response shape — but that function does not exist yet. If Hiring Spartans has been told this is AI-powered, know that it's currently rule-based, not model-based.

### Pipeline UI notes

- Telora's logo component is now inline SVG, not a runtime image fetch.
- The overdue-follow-up warning icon has a hover tooltip/accessible label with the due date.
- Next follow-up is hidden in the candidate detail form for closed-stage candidates (Joined, Invoiced, Paid, Dropped).
- The account menu moved out of the top-right header and now lives at the bottom of the left sidebar.
- Candidate detail opens by clicking the candidate name in the grid; the old eye/view button is gone.
- The pipeline grid has per-column filters and type-aware sorting for text, numbers, dates, stage, recruiter, docs, and duplicate-match state.
- The standalone Stage and Recruiter toolbar dropdowns were removed; use the Stage and Recruiter column filters instead.
- Saved pipeline views are normalized on load so old stageFilter/recruiterFilter saved views become the new columnFilters shape.

## 5. Business rules worth knowing before you touch anything

- Stale/returning candidate rule: re-application by a previously archived candidate triggers a warning that opens the archived record (referenced as "the returning Rohit warning" in the deploy checklist) rather than silently creating a duplicate.
- Sample data isolation: seeded/demo candidates are flagged is_demo, go through the same authenticated RLS-protected paths as real data, and cannot be permanently deleted through the normal candidate-delete RPC — only through the explicit "Remove demo data" flow (requires typing REMOVE SAMPLE DATA to confirm). Real candidate data is never touched by this.
- Invoice eligibility is centralized in isInvoiceEligible in src/utils/candidateUtils.js. A candidate is eligible only when stage = Joined, is_archived is false, actual_joining_date is present, actual_joining_date + 90 days <= today (eligible on day 90, inclusive), and retention_status is not Failed or Replacement Required. Joined candidates missing actual_joining_date are surfaced as a visible "needs actual joining date" state instead of silently disappearing from invoice work.
- Actual joining date is an editable pipeline-grid column. The 202609130001_add_actual_joining_date_to_operations.sql migration added actual_joining_date to update_candidate_operations while keeping the existing owner/archive permission checks intact.
- Current in-app pipeline stages are still the 10-stage PIPELINE_STAGES list. The product owner's 16-stage lifecycle model (Company Requirement → ... → Payment Received) is the reference model the pipeline is evolving toward, and lifecycle milestone date fields remain an ongoing effort.
- 11 migrations applied, timestamp-ordered, none reverted or hand-edited after the fact (per the docs/MVP_DEPLOYMENT.md deploy discipline). Don't hand-edit an already-applied migration — add a new one.

## 6. Known limitations (real, not the AI-generated placeholder list from before)

- No production LLM backend — "Ask Telora" is rules-based only.
- No email/WhatsApp provider integration — manual draft-and-copy only.
- Retention and invoice milestone fields exist, but invoice_eligibility_date and retention_* fields are not yet admin-editable/read-only-for-recruiters in the product-owner target model.
- Single organisation in practice (Hiring Spartans); multi-tenant behaviour exists in schema (organisation_id scoping) but has only ever been exercised by one tenant.
- Free-plan 15-user cap is a hard DB constraint, not a soft UI warning.

## 7. Existing internal roadmap

docs/COMPETITIVE_GAP_AUDIT.md already has a prioritised P0–P3 list (protect trust/ops → beat the spreadsheet → reduce coordination effort → defer until usage proves the need). Read that before proposing new priorities — don't re-derive a roadmap that already exists in the repo.

Current priority order:

1. P2 next up: make retention/eligibility dates (invoice_eligibility_date, retention_* fields) admin-editable and read-only for recruiters.
2. Landing page/AuthPage copy cleanup: remove duplicate brand text, drop unverifiable "Powered by AI", generalise away from banks-only, and remove Supabase mentions. This is still pending; the current AuthPage still contains those strings.
3. Recruiter Salary & Leave module from product-owner feedback: P2, not started.
4. Naukri Resdex sourcing plus real AI for Ask Telora: deferred.

## 8. Rules for any agent working on this repo

- Never expose secrets. Nothing but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY goes into VITE_-prefixed env vars.
- Never weaken RLS to make a feature easier to build.
- Don't modify an already-applied migration — write a new one.
- Work in a feature branch → review → merge to main. main auto-deploys to Netlify via the connected repo.
- Run pnpm install && pnpm test && pnpm build before calling anything done.
- Before making changes: pull main, check git log for anything since this file was last updated, and re-verify any claim in this document that matters for the task at hand. This file is a starting point, not a source of truth that overrides the live repo.

## 9. Ownership

Repo owner / product decision-maker: Karan Munjal (munjalkaran). Client-facing accountability, roadmap calls, and what ships are his to decide — an agent proposes, it doesn't merge to main unasked.
