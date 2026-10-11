# Telora — Master Context

Purpose of this file: permanent handover doc for any AI agent (Claude, ChatGPT, Codex, or future tools) picking up work on this repo. Read this first. If anything here conflicts with the actual code, migrations, or main branch — the repo wins, not this file. Update this file whenever a major decision, rule, or architecture change lands on main.

Last verified against repo state: origin/main commit a25d9b8 ("Reject null and inactive actors in privileged RPCs"), by direct inspection of code/migrations/docs — not from chat history or a prior agent's summary.

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
- Five retention fields are now admin-only in the UI and permission helpers: retention_period_days, retention_start_date, retention_due_date, retention_status, and replacement_guarantee_end_date. Migration 202609280001 removed those fields from the allowlist of the security-definer RPC update_candidate_profile_extensions. Recruiters still see those fields in the candidate detail dialog, disabled, with an "Admin-managed" hint. actual_joining_date deliberately remains recruiter-editable because recruiters are the ones who confirm joining. Admins edit the retention fields through the existing direct table update path, which was already admin-only under RLS; no RLS policy was changed.
- The retention restriction was an RPC fix, not an RLS fix. RLS on candidates was already admin-only for direct updates. The gap was update_candidate_profile_extensions: it is SECURITY DEFINER, runs with elevated privileges, and has its own field allowlist. That allowlist is a second security boundary that RLS does not protect. Any future permissions audit on this repo must check both RLS policies and security-definer RPC allowlists.
- Migration 202609290001 fixed the P0 null-actor authorization bypass found by the overnight audit. current_profile() returns null for inactive or missing profiles; before the fix, negative comparisons against null (for example organisation_id <> null or role <> 'admin') evaluated to null rather than false, so PL/pgSQL IF checks did not enter the rejection branch. The migration added an explicit "if actor.id is null then raise exception" guard to update_candidate_operations, update_candidate_profile_extensions, request_candidate_change, archive_candidate, record_email_draft_opened, record_duplicate_warning_dismissed, and link_candidate_records, and changed several role checks to positive actor.role = 'recruiter' checks. assert_admin() already had the explicit null check.
- Remaining lower-priority bug class: several functions still compare candidate organisation fields before explicitly checking that the candidate row exists. In archive_candidate, record_email_draft_opened, record_duplicate_warning_dismissed, link_candidate_records, and request_candidate_change, candidate.organisation_id <> actor.organisation_id evaluates to null when the candidate row does not exist. This mostly fails closed downstream, but archive_candidate can write an audit row for a UUID that was never a candidate. Add explicit candidate.id null guards in a future migration. This is pre-existing and was not introduced by 202609290001.
- Archive, restore, permanent delete, and candidate creation are all RPC-gated, not direct table writes.
- supabase/migrations/202607220002_rls_policies.sql defines only profiles_update_admin for updates on public.profiles. A user cannot update their own profile row. Making My Profile editable would require a new profiles_update_self policy that whitelists full_name and avatar_url and explicitly blocks role and organisation_id changes to prevent self-escalation to admin. That migration has not been written.
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
| My Profile page | Live — read-only at /profile; shows name, email, role, organisation, account-created date when available, and a change-password action; deliberately not editable |
| Invoicing (CSV export, mark-invoiced, bank/NBFC grouping) | Live — eligibility is Joined + active + actual joining date + day-90 rule + billable retention status |
| PDF invoice | Live |
| CSV candidate import/export | Live |
| Sample/demo data (seed + reversible remove/restore) | Live — 19 seeded records, admin-only, RPC-gated |
| "Ask Telora" AI panel | Live but not actually AI — see below |
| Retention tracking fields (retention period, due date, replacement guarantee) | Live — five retention fields are admin-only; recruiters see them disabled in candidate detail with an "Admin-managed" hint; retention_status affects invoice eligibility by excluding Failed and Replacement Required |
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
- The saved views dropdown lists saved views first, then a single inline "+ Save current view" row below a divider. There is no separate Save button and no persistent name input sitting above the list; the name input appears inline only after choosing "+ Save current view".
- Saved views and Export each have their own trigger ref, with whichever menu is active wired into useDismissibleSurface.
- The toolbar section carries relative z-40 because .glass-panel in src/index.css applies backdrop-filter, which creates a new stacking context and traps any child z-index inside it. This lets toolbar menus paint above the CandidateGrid sticky header (z-30) and sticky header columns (z-40); raising only the menu's own z-index does not work.
- src/components/AskCommandBar.jsx has been deleted. The fixed bottom command bar is gone. Ask Telora now lives in the sidebar footer as a compact row, below Coming Soon and above the slimmed account row.
- The --ask-command-bar-height and --ask-command-bar-gap CSS variables were removed from src/styles/theme.css.
- "profile" is in ROUTE_PAGES in src/utils/routing.js, while canAccessPage in src/utils/permissions.js explicitly allows it for any authenticated user. It has no sidebar nav entry; users reach /profile only from My Profile in the account menu.
- Commit 5a4017b completed the public copy cleanup: the duplicate AuthPage brand heading was removed because TeloraFullLogo already renders the wordmark as SVG; "Powered by AI" was removed from AuthPage, Sidebar, and SettingsPage; banks/NBFC-only positioning was generalised to staffing and recruitment agencies; and customer-facing Supabase mentions were removed from AuthPage prose and SampleDataToggle.
- Deliberately kept: AuthPage still names Supabase and the exact VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY variables in the configuration warning rendered when those variables are missing. This is intentional developer/operator diagnostics, not leftover marketing copy; it is not rendered in a correctly configured production deployment. DemoDataManager also names supabase/seed.sql in an admin setup instruction when sample data has not been initialised. Other Supabase references across src/ are implementation identifiers and helper names such as hasSupabaseConfig, friendlySupabaseError, and the supabase client, not customer-facing product claims.
- Commit 8211c07 removed invoice_eligibility_date from the candidate detail UI and ADMIN_ONLY_CANDIDATE_FIELDS. The field had been stored, displayed, and admin-editable, but isInvoiceEligible never read it. Do not re-add it as a visible/admin-editable UI field unless the product deliberately changes invoice eligibility semantics.

## 5. Business rules worth knowing before you touch anything

- Stale/returning candidate rule: re-application by a previously archived candidate triggers a warning that opens the archived record (referenced as "the returning Rohit warning" in the deploy checklist) rather than silently creating a duplicate.
- Sample data isolation: seeded/demo candidates are flagged is_demo, go through the same authenticated RLS-protected paths as real data, and cannot be permanently deleted through the normal candidate-delete RPC — only through the explicit "Remove demo data" flow (requires typing REMOVE SAMPLE DATA to confirm). Real candidate data is never touched by this.
- Invoice eligibility is centralized in isInvoiceEligible in src/utils/candidateUtils.js. A candidate is eligible only when stage = Joined, is_archived is false, actual_joining_date is present, actual_joining_date + 90 days <= today (eligible on day 90, inclusive), and retention_status is not Failed or Replacement Required. Joined candidates missing actual_joining_date are surfaced as a visible "needs actual joining date" state instead of silently disappearing from invoice work. invoice_eligibility_date is deliberately not part of this calculation.
- invoice_eligibility_date still exists as a database column and is still present in historical migrations/demo data. It was not dropped on purpose: dropping it gains nothing for users, would be irreversible in production, and is not needed to remove the misleading UI. Treat the orphan column as a deliberate compatibility decision, not a bug to "fix" casually.
- Actual joining date is an editable pipeline-grid column. The 202609130001_add_actual_joining_date_to_operations.sql migration added actual_joining_date to update_candidate_operations while keeping the existing owner/archive permission checks intact.
- Current in-app pipeline stages are still the 10-stage PIPELINE_STAGES list. The repository contains no trusted 16-stage lifecycle list: only the endpoints Company Requirement and Payment Received, plus the number 16. docs/audit/DESIGN_LIFECYCLE_STAGES.md contains a proposed 16-stage list for owner review, not a confirmed product decision.
- 13 migrations applied, timestamp-ordered, none reverted or hand-edited after the fact (per the docs/MVP_DEPLOYMENT.md deploy discipline). Don't hand-edit an already-applied migration — add a new one. Current list:
  1. 202607220001_initial_schema.sql
  2. 202607220002_rls_policies.sql
  3. 202607220003_rpc_functions.sql
  4. 202607220004_seed_helpers.sql
  5. 202607230001_demo_data_support.sql
  6. 202607310001_vacancies_and_candidate_extensions.sql
  7. 202607310002_interviews.sql
  8. 202608010001_demo_extensions_scorecards_activity_views_billing.sql
  9. 202608010002_candidate_workflow_and_retention.sql
  10. 202608010003_safe_permanent_candidate_delete.sql
  11. 202609130001_add_actual_joining_date_to_operations.sql
  12. 202609280001_restrict_retention_invoice_fields_to_admin.sql
  13. 202609290001_reject_null_actors_in_privileged_rpcs.sql

## 6. Scripts

- scripts/snapshot.sh prints Git state, the file tree for src/, supabase/migrations/, and docs/, plus the full contents of any files passed as arguments, as one pasteable block with a character-count footer. It exists so an AI agent on a fresh machine can get a compact repo snapshot without re-downloading and re-grepping the same context every session. Usage is documented under Scripts in README.md.

## 7. Overnight audit documents

Eight audit documents now live in docs/audit/, produced 2026-09-29 by a read-only static audit. AUDIT_SUMMARY.md is the entry point. The branch merged into this repo contains these files: AUDIT_SUMMARY.md, DEAD_CODE.md, DESIGN_LIFECYCLE_STAGES.md, DESIGN_SALARY_LEAVE.md, FIELD_AUDIT.md, PERFORMANCE.md, SECURITY_AUDIT.md, and TEST_GAPS.md.

The audit documents are analysis, not decisions. Their recommendations are not product commitments until Karan approves them.

Headline finding: the audit identified the P0 null-actor authorization bypass described in the security model above. It is fixed by migration 202609290001, with a remaining P2 null-candidate guard follow-up still open.

docs/audit/DESIGN_LIFECYCLE_STAGES.md is explicitly proposed design work. Do not present its 16-stage list as the owner's confirmed list.

## 8. Known limitations (real, not the AI-generated placeholder list from before)

- No production LLM backend — "Ask Telora" is rules-based only.
- No email/WhatsApp provider integration — manual draft-and-copy only.
- Lifecycle milestone date fields beyond actual_joining_date are not built yet.
- Single organisation in practice (Hiring Spartans); multi-tenant behaviour exists in schema (organisation_id scoping) but has only ever been exercised by one tenant.
- Free-plan 15-user cap is a hard DB constraint, not a soft UI warning.

## 9. Existing internal roadmap

docs/COMPETITIVE_GAP_AUDIT.md already has a prioritised P0–P3 list (protect trust/ops → beat the spreadsheet → reduce coordination effort → defer until usage proves the need). Read that before proposing new priorities — don't re-derive a roadmap that already exists in the repo.

Current priority order:

1. P1 — brand logo sting and product film. In progress. Captures must happen before any pipeline grid or UI changes, otherwise the film has to be reshot. No migration.
2. P1 — invoice integrity: make mark-invoiced a single transactional bulk RPC with a durable unique invoice number, and paginate the invoice PDF. Currently one row at a time, hard-coded daily 001 suffix, single fixed page that can drop or overlap placements. Migration required.
3. P1 — restore same-organisation active-owner validation in create_candidate and on correction approval. A later redefinition dropped the check, so an admin can create a candidate owned by a profile in another organisation. Migration required.
4. P1 — wire or remove placebo settings: display_name, email_signature and default_email_template save successfully but do not all drive product behavior.
5. P2 — behaviour before fields: define the 3-5 lifecycle events that should trigger work (expected join slipping, offer waiting, documents blocked, retention risk) and build alerts and filters for those. The 16 milestone date fields are deprioritised until this is done. Reason: the product already has offer, joining and retention fields that nothing reads, and adding sixteen more dates makes a better spreadsheet, not a better tool.
6. P2 — add explicit null-candidate guards to archive_candidate, record_email_draft_opened, record_duplicate_warning_dismissed, link_candidate_records, and request_candidate_change. update_candidate_operations already has this guard ("if old_row.id is null or old_row.organisation_id <> actor.organisation_id"), added by migration 202609290001. Use that exact line as the pattern for the remaining five functions. Verified against the live database on 2026-10-12.
7. P2 — Recruiter Salary & Leave module. Deferred until invoice integrity is complete, because it adds money and approvals. Design already written at docs/audit/DESIGN_SALARY_LEAVE.md.
8. P3 — Naukri Resdex sourcing and real LLM for Ask Telora.

## 10. Environment facts for agents

- Two clones exist on the office laptop. The live one is `/Users/karan.munjal/Projects/recruitment pipeline tool/recruitops`. `/Users/karan.munjal/Projects/recruitops` is stale and should be deleted.
- The office network blocks outbound SSH on port 22. `~/.ssh/config` correctly routes github.com through ssh.github.com on port 443. Do not "fix" this.
- Repo-local git identity is set to the GitHub noreply address, overriding the global work email. Do not change the global config.

## 11. Rules for any agent working on this repo

- Never expose secrets. Nothing but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY goes into VITE_-prefixed env vars.
- Never weaken RLS to make a feature easier to build.
- Don't modify an already-applied migration — write a new one.
- Work in a feature branch → review → merge to main. main auto-deploys to Netlify via the connected repo.
- Run pnpm install && pnpm test && pnpm build before calling anything done.
- Before making changes: pull main, check git log for anything since this file was last updated, and re-verify any claim in this document that matters for the task at hand. This file is a starting point, not a source of truth that overrides the live repo.

## 12. Ownership

Repo owner / product decision-maker: Karan Munjal (munjalkaran). Client-facing accountability, roadmap calls, and what ships are his to decide — an agent proposes, it doesn't merge to main unasked.
