# Telora overnight audit — coffee summary

Audit date: 2026-09-29. Branch: `codex/overnight-audit-2026-09-29`. Static repository audit plus local tests/build only; no live Supabase access and no source/migration changes.

## The five findings that matter most

1. **Turning off a recruiter does not reliably turn off their write access.** An authenticated account with an inactive or missing profile can call three elevated database functions with a candidate UUID and change workflow/profile fields or archive the record. If a former recruiter retains a session and an ID they previously saw, Telora's apparent deactivation control can be bypassed.
2. **The invoicing path can produce partial or incomplete accounting results.** Marking candidates invoiced updates one row at a time, so a failure halfway leaves a mixed batch. The PDF is one fixed page and can lose/overlap a long candidate list. Invoice numbers end in a hard-coded daily `001`, so repeated invoices can collide. This can create missed revenue, duplicate document numbers, or a client invoice that omits placements.
3. **Several editable fields create false confidence.** Organisation display name, email signature, and email template save successfully but affect nothing. Most offer/joining milestones are stored without alerts or workflow. Retention dates look invoice-driving, but invoicing uses a separate fixed day-90 calculation. Users can enter “authoritative” data and reasonably expect behavior that never occurs.
4. **The current data-loading model will get slower with success.** Every login fetches the full candidate/interview/audit/activity world, and every candidate/profile/interview/request realtime event refetches 12 resources. Bulk imports and invoices add one request per row, while duplicate matching is quadratic. On a constrained Indian mobile connection, a realistic admin view can take an estimated 7–12+ seconds as history grows.
5. **82 green tests do not protect the risky boundaries.** There is no executed RLS/RPC test database, browser flow, CSV validation suite, or destructive-action integration test. Source-string tests all pass while the P0 database authorization bypass remains present. The count overstates production protection.

## Ranked backlog

Size guide: **one prompt** = focused change; **a few prompts** = coordinated code/test work; **project** = multi-part design/migration/rollout.

### P0 — stop and fix before feature work

| Item | Why it matters | Size | Migration? |
|---|---|---:|:---:|
| Reject null/inactive actors in every authenticated `SECURITY DEFINER` RPC, using positive authorization checks | deactivated/unprovisioned Auth users can update or archive any known candidate UUID; current P0 paths are operations, profile extensions, and archive | one prompt | Yes |
| Add executable database tests for inactive actor and final role/RLS matrix | prevents the immediate fix and future definer/RLS allowlists from silently drifting again | a few prompts | No schema migration; test DB required |

### P1 — protect money, tenant integrity, and user trust

| Item | Why it matters | Size | Migration? |
|---|---|---:|:---:|
| Restore same-organisation active-owner validation in latest `create_candidate`; validate owner again on correction approval | current admin/import and approval paths can create cross-tenant owner links and corrupt visibility/accountability | one prompt | Yes |
| Make mark-invoiced a single transactional bulk RPC with a unique, durable invoice/batch identifier | prevents partial month-end state and repeated `...-001` invoice collisions | a few prompts | Yes |
| Paginate the invoice PDF and add long-invoice golden tests | current fixed-page output can omit/overlap placements, directly affecting client billing | one prompt | No, unless invoices are persisted |
| Make CSV import validated and transactional | one bad row currently leaves a partial import; blank/dirty/duplicate/formula-like data is largely untested | a few prompts | Likely Yes for bulk RPC; validation UI no |
| Wire or remove `display_name`, `email_signature`, and `default_email_template` controls | saving placebo settings damages trust; email/branding continues unchanged | one prompt | No |
| Choose one retention/invoice clock | editable retention dates can disagree with the actual fixed day-90 rule | a few prompts | Possibly, depending on source of truth |
| Make expected joining/risk fields actionable before adding more milestone dates | avoids expanding a forms-only lifecycle that does not return work to recruiters | a few prompts | No for filters/alerts; future milestones Yes |
| Enforce `organisations.is_active` if it is intended to disable a tenant | the stored flag currently does not participate in profile/access checks | one prompt | Yes |
| Replace full realtime refresh with targeted/coalesced updates; narrow/paginate initial data and lazy-load audit/activity | prevents latency, database load, large PII transfers, and event storms as records grow | project | Maybe indexes/RPCs |

### P2 — harden workflows and reduce misleading/dead surface

| Item | Why it matters | Size | Migration? |
|---|---|---:|:---:|
| Restrict recruiter interview updates to mutable workflow columns | direct REST updates can rewrite authorship/demo provenance while row ownership still passes | a few prompts | Yes or RPC/privilege migration |
| Validate JSON object shape and reject empty update payloads | malformed document checklists can break UI; no-op calls create audit noise | one prompt | Yes |
| Guard audit-event RPCs against null actors and validate linked IDs | prevents false cross-record audit events by inactive users | one prompt | Yes |
| Load and honor `candidate_links`, or remove the Link action/RPC | today “linking” persists a row the app never reads, so the decision vanishes on reload | a few prompts | Maybe, depending on chosen model |
| Resolve audit/activity actor IDs and define snapshot retention/redaction | users see generic actor names while full PII snapshots accumulate and transfer | a few prompts | Possibly policies/view/indexes |
| Make demo remove/restore one recoverable transaction | two separate RPCs can leave candidates and extensions in inconsistent removed/restored states | a few prompts | Yes |
| Route/feature split Interviews, Vacancies, Administration, Invoicing/PDF, Ask, and admin pages; dev-only import mocks | removes an estimated 25–40 kB gzip from first load and clears the 609 kB single-chunk warning | a few prompts | No |
| Replace O(n²) duplicate matching with normalized exact-match indexes plus narrowed fuzzy matching | avoids browser stalls as candidate count grows | a few prompts | Maybe indexes/RPC |
| Centralize interview enums, date derivation, and vacancy days-open logic | prevents UI/status/timezone drift across duplicated implementations | one prompt | No |
| Stop writing compatibility-only `invoice_eligibility_date` and document it | prevents future SQL/report consumers mistaking stale demo-populated data for the real rule | one prompt | A schema comment/new migration is advisable |

### P3 — cleanup and clarity

| Item | Why it matters | Size | Migration? |
|---|---|---:|:---:|
| Remove unreachable components/hooks, unused exports, dead candidate/change-request/invoice service layer, and `supabaseClient.js` shim | reduces false code paths and reviewer load; there is only one actual Supabase client | one prompt | No |
| Rename active Ask service/symbol/test/console RecruitOps references, preserving storage/channel compatibility keys | finishes internal Telora rename without discarding user sessions/theme | one prompt | No |
| Review direct authenticated grants on RLS helper functions | policy helpers need to work internally but likely do not need direct client RPC exposure | one prompt | Yes |
| Decide whether recruiter-readable billing tax/payment data and admin-only “shared” saved views match product intent | current policies may be intentional, but documentation is unclear | one prompt | Maybe |
| Resolve dead/placeholder fields: interview panel/escalation owner IDs, billing PAN, saved-view sharing, avatar writer | reduces schema/UI claims that do not have a complete feature | a few prompts | Yes for removals; no for wiring some fields |

## Product direction: where I think the current plan is wrong

1. **Do not make “16 lifecycle milestone date fields” the next priority as currently framed.** Telora already has a block of editable offer/joining/retention fields that mostly do nothing. More dates create a more convincing spreadsheet, not more automation. First define the 3–5 events that trigger work—expected join slipping, offer waiting, documents blocked, retention risk—and build alerts/ownership/filters around them. Add a field only when its downstream behavior is named.
2. **Do not start Salary & Leave before the P0, invoice integrity, and database integration harness are done.** Salary/leave adds money, approvals, balances, and irreversible trust consequences to a security model that currently lets inactive accounts reach elevated RPCs.
3. **Treat invoicing as a financial workflow, not a download button.** It needs an atomic batch, durable invoice number, reproducible contents, multi-page output, and rerun/idempotency rules before it should be called production-safe.
4. **Do not claim multi-tenant confidence yet.** The schema is tenant-aware, but production is one tenant, cross-tenant owner validation has drifted, and there is no two-organisation executable policy test. Position it as single-tenant-in-practice until that harness passes.
5. **Keep Ask Telora useful but stop framing it as AI.** The deterministic interpreter is a good low-cost feature; calling it AI invites expectations it cannot meet. Real LLM work remains correctly deferred behind clean underlying data.
6. **“Spreadsheet feel” should describe interaction, not data architecture.** Loading every row and every audit snapshot to the browser will undermine the fast, calm experience the product is trying to preserve.

## What went well

- The latest retention allowlist correctly removes the five admin-only fields.
- Direct candidates RLS remains admin-only for updates; recruiters use scoped RPCs.
- Core invoice eligibility is centralized and tested at the day-90 boundary.
- Demo data is recoverable and real candidate deletion has meaningful guards.
- The bundle warning is real but compressed JS is not catastrophic; targeted splits can fix it without a rewrite.
- There is no hidden heavyweight PDF dependency or duplicate Supabase client instance.

## Could not determine

- **Effective production database state:** no live Supabase query was made, so applied-migration drift, actual grants/policies, row counts, indexes, and database settings are unknown.
- **Current remote repository state:** local `main` reported “up to date with origin/main,” but `git pull` then stalled and was terminated. Later pushes failed/stalled because remote access was unavailable. The audit is based on local commit `8211c07` plus the audit branch.
- **Real mobile performance:** estimates use build sizes and assumed 400 kbps–1 Mbps conditions, not RUM/WebPageTest or anonymized production payloads.
- **Business intent:** whether recruiters should read billing tax/payment settings; whether saved views should actually be shared with recruiters; whether organisation `is_active` is meant to disable access; and which retention date is contractually authoritative.
- **External consumers:** repository search shows `supabaseClient.js` unused, but an external/untracked import cannot be disproved.
- **Data retention/compliance requirements:** the code stores full old/new candidate snapshots, but no documented retention/redaction period was found.

## Evidence documents

- `docs/audit/SECURITY_AUDIT.md`
- `docs/audit/FIELD_AUDIT.md`
- `docs/audit/DEAD_CODE.md`
- `docs/audit/TEST_GAPS.md`
- `docs/audit/PERFORMANCE.md`
