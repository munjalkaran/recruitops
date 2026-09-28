# Telora test coverage audit

Audit date: 2026-09-29. `pnpm test` passes: **20 files, 82 tests, 82 passed** in 643 ms. That speed reflects a focused unit/string-contract suite; it is not database, browser, or end-to-end coverage.

## What is meaningfully protected

- **Invoice eligibility core:** exact day 90 versus day 89, missing actual joining date, failed/replacement retention states, final stages excluded, totals/grouping sharing the same rule, and one mocked mark-invoiced selection test.
- **Pipeline presentation logic:** stable type-aware grid sorting, combined column filters, missing-date filters, recruiter/match filters, legacy saved-view normalization, and input non-mutation.
- **Stale-candidate rule:** overdue open candidates versus closed stages.
- **Interview pure logic:** feedback grace period, attention reasons, relative-day grouping, and scorecard averaging.
- **Demo frontend behavior:** production does not use local fallback, healthy remote data is not mixed with mocks, removed samples are hidden, restoration does not duplicate the tested array, and recruiter mock visibility is scoped.
- **Utility behavior:** document checklist status/progress, greeting variants, basic duplicate detection against an archived candidate, routing normalization, activity ordering, and deterministic Ask Telora answers for four query families.
- **UI permission helpers:** admin actions, owner-only recruiter operations, protected-field correction routing, profile route access, and current retention-field UI permissions.
- **PDF minimum safeguards:** eligible candidates only and extractable configured invoice text.
- **Selected source contracts:** 15 tests assert that particular strings/imports/styles remain in component source. These protect recent layout decisions from accidental deletion but do not render or interact with the UI.
- **Selected migration text contracts:** demo and workflow tests confirm expected SQL fragments exist. They do not execute SQL or prove the effective final migration state.

## Important limitations in the existing suite

1. There is no PostgreSQL/Supabase test database. RLS, grants, triggers, constraints, transactions, null semantics, and `SECURITY DEFINER` execution are untested.
2. There is no browser/component test environment. Dialog validation, auth expiry, realtime updates, navigation, file import, and destructive confirmations are not interacted with.
3. Many “security” tests inspect source strings. A dangerous expression can still be present and satisfy the test; the P0 null-profile bypass passes all 82 tests.
4. The only test for `invoiceService` covers a module not reached by production. `App.jsx` uses its own direct mark-invoiced implementation, so that green test does not protect the live path.
5. There are no tests for `src/utils/csv.js`, despite CSV import/export being a core adoption and data-ingestion path.

## Risky gaps by area

| Gap | What can silently break | Blast radius |
|---|---|---|
| Null/inactive profile behavior in every authenticated definer RPC | deactivated user mutates or archives known candidates across owner/tenant boundaries | **Critical** — trust/security incident |
| Effective RLS/grants after the full migration chain | recruiter reads/writes rows outside scope; a later policy replacement weakens earlier guarantees | **Critical** — all customer data |
| Cross-organisation foreign keys through `create_candidate` and approved owner corrections | candidates assigned to another tenant's profile; visibility and accountability corrupt | **Critical** in multi-tenant use |
| Live mark-invoiced flow atomicity | some candidates become Invoiced while later updates fail; UI can report mixed success as a completed batch | **High** — month-end billing/revenue |
| Money and invoice-output edge cases | wrong totals from malformed/decimal fees, inconsistent grouping, missing issuer/tax data, duplicate invoice numbers | **High** — financial/customer documents |
| CSV parser/import validation | blank-name candidates, wrong dates/numbers, unknown recruiters, formula-injection exports, duplicate rows, or partial imports | **High** — bulk data corruption and spreadsheet risk |
| Permanent delete cascade in a real DB | history removed too broadly, FK failure midway, or protected billing records deleted despite text contract | **Critical** — irreversible data loss |
| Demo remove/restore orchestration across multiple RPCs | base candidates removed while demo vacancies/interviews remain, or vice versa, after a partial failure | **High** — confusing/destructive admin state |
| Archive/restore and correction concurrency | stale approvals overwrite newer edits; duplicate pending requests or restore/delete races lose intent | **High** — candidate record integrity |
| Interview direct-update field scope | recruiter rewrites created_by/demo/provenance columns while row-level test still passes | **High** — audit integrity |
| Realtime reconciliation | duplicate events, stale local rows, cross-page inconsistency, or missed changes after reconnect | **High** — daily multi-user operation |
| Auth/session persistence and deactivation | “remember me,” cross-tab sign-out, expired refresh, inactive profile, password recovery regressions | **High** — access control/availability |
| UI permission enforcement | hidden buttons and disabled fields diverge from actual routing after refactor | **Medium**, because DB should remain authoritative; currently P0 RPC bug raises consequence |
| Candidate links persistence | “linked” records are not honored after reload; returning-candidate decisions vanish | **Medium** — duplicate workflow confusion |
| Offer/retention field semantics | apparently authoritative values disagree with calculations | **High** for retention/invoice; Medium for other milestones |
| Component interaction/accessibility | focus trap, keyboard menus, confirmation phrases, inline edit error handling fail despite string tests | **Medium** — usability and accidental actions |

## Ten highest-value tests to add

1. **Inactive-profile RPC denial (database integration):** authenticate a user whose profile is inactive/absent and assert every authenticated `SECURITY DEFINER` business RPC rejects before reading or writing, including a known candidate UUID.
2. **Admin/recruiter RLS matrix (database integration):** seed two organisations and assert select/insert/update/delete behavior for every table and role against the final migration chain.
3. **Candidate mutation allowlist contract (database integration):** call operations/profile-extension RPCs as admin, owner recruiter, other recruiter, inactive user, and malformed JSON; assert exact permitted columns and unchanged forbidden fields.
4. **Cross-tenant ownership rejection (database integration):** assert `create_candidate`, change-request approval, vacancy assignment, interview references, and link RPCs reject profile/candidate/vacancy IDs from another organisation.
5. **Atomic mark-invoiced batch (integration/E2E):** inject a failure in the middle of a multi-candidate invoice action and assert either all eligible rows move to Invoiced or none do, with an accurate user result.
6. **CSV hostile/dirty input suite (unit + integration):** cover quoted commas/newlines, duplicate/unknown headers, blank names, invalid/negative money and experience, invalid dates/emails/phones, unknown recruiters, duplicate candidates, and spreadsheet-formula export escaping.
7. **Permanent delete database behavior (integration):** verify confirmation, admin-only/archived/non-demo/non-finalised constraints, exact interview/audit cascade, other candidates untouched, and retained organisation-level audit event.
8. **Demo removal failure/recovery (integration/E2E):** fail one of the candidate/vacancy/interview removal steps and prove the UI/database reaches a recoverable, consistent state without touching real rows.
9. **Invoice document golden cases (unit):** assert exact totals/grouping/rounding, blank-vs-configured legal/tax fields, stable invoice numbering expectations, long text/page overflow, and no Invoiced/Paid/failed-retention candidates.
10. **Realtime multi-user reconciliation (E2E):** two authenticated browser sessions update/assign/archive the same candidate and assert scoped, de-duplicated, reconnect-safe UI state.

## Additional targeted tests worth adding

- Correction approval after the candidate/owner/request changes concurrently.
- Interview provenance fields cannot be changed by a recruiter through REST updates.
- `document_checklist` rejects non-object JSON at the RPC boundary.
- Persisted candidate links suppress/label future duplicate warnings after reload.
- Expected joining and retention fields either drive the intended alert/calculation or are explicitly verified as informational.
- Auth cross-tab sign-out, remember-session migration, password recovery, token refresh, and profile deactivation.
- Rendered component tests for dialog focus, escape/backdrop behavior, keyboard menus, inline-edit failures, and confirmation copy.
- Bundle smoke test that opens every route after lazy loading is introduced.

## Suggested testing shape

- Keep the fast pure-unit suite.
- Replace high-risk migration string tests with a disposable local Supabase/Postgres integration job that applies all migrations from zero.
- Add a small rendered component suite for forms and destructive confirmations.
- Add 3–5 Playwright flows: recruiter ownership, admin invoice, CSV import, demo remove/restore, and two-user realtime.
- Measure coverage by protected business risk, not the raw test count.
