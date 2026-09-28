# Telora dead-code and duplication audit

Audit date: 2026-09-29. Method: static module reachability from `src/main.jsx`, export/reference search across production and tests, package/config inspection, and rule-by-rule comparison. No source was changed.

## Executive result

There is only one Supabase client instance. `src/lib/supabaseClient.js` is a one-line unused re-export, not a second `createClient` call, so it does **not** create a second auth session. The larger issue is an abandoned service/hook layer beside a monolithic `App.jsx`: candidate and change-request services exist but the app implements the same calls inline. Several unused components and exports are safe cleanup candidates. The most dangerous duplication is permission/update field lists repeated across constants, UI routing, and SQL RPC allowlists, because those copies have already drifted once.

## Unreachable modules and components

“Break if removed” assumes the current production entry graph. Tests or future plans are noted separately.

| Item | Evidence | What breaks if removed now | Confidence |
|---|---|---|---|
| `src/components/SampleDataBanner.jsx` | no import; Overview uses `SampleDataToggle`, Settings uses `DemoDataManager` | nothing in production | High |
| `src/components/auth/LoginPage.jsx` | no import; `App.jsx` renders `AuthPage` directly | nothing in production | High |
| `src/components/auth/ForgotPasswordPage.jsx` | no import; password modes are handled through `AuthPage`/auth state | nothing in production | High |
| `src/hooks/useCandidates.js` | no import | nothing; its list/subscription path is duplicated in `App.jsx` | High |
| `src/hooks/useProfile.js` | no import | nothing; `AuthContext` owns profile state | High |
| `src/lib/supabaseClient.js` | no import; content is only `export * from "./supabase"` | nothing unless an external/untracked consumer imports it | High |
| `src/services/changeRequestService.js` | no production import | nothing; `App.jsx` performs list/request/review/realtime directly | High |
| `src/services/invoiceService.js` | imported only by its test; no production import | nothing in production; its unit test must be removed/rewritten | High |
| `src/services/candidateService.js` | no production path reaches it; only dead invoice service and dead hook import it | nothing in production; dead-module tests may need adjustment | High |

All other `src/components/` modules are reachable from `main.jsx` through `App.jsx` or their parent component.

Recommendation: delete the unreachable UI/hooks and either delete the abandoned services or deliberately refactor `App.jsx` to use them. Keeping both makes reviewers inspect code that cannot run and invites fixes to the wrong path.

## Unused exports in otherwise live modules

| Export | Current state | What breaks if removed | Confidence |
|---|---|---|---|
| `DOC_STYLES` in `constants/pipeline.js` | no production reference | nothing | High |
| `formatRupees`, `getStageCounts` in `candidateUtils.js` | no production reference; some utility tests may refer to the module generally | no runtime behavior; update direct tests if present | High |
| `CONFIRMATION_STATUSES`, `INTERVIEW_STATUSES` in `utils/interviews.js` | definitions are unused because components repeat inline arrays | nothing if inline copies stay | High |
| `canManageDemoData` in `utils/permissions.js` | no reference | nothing | High |
| `getDemoDataStatus`, `seedDemoData` in `demoDataService.js` | app uses a direct status RPC and separate seed orchestration | nothing in current runtime | High |
| `listInterviews` in `interviewService.js` | app loads interviews directly, but uses create/update exports | nothing | High |
| `listSavedViews` in `savedViewService.js` | app loads directly, but uses create/delete exports | nothing | High |
| `listOrganisationProfiles`, `updateProfile` in `profileService.js` | `getCurrentProfile` is live; list/update are duplicated in `App.jsx` | nothing | High |

The dead service modules also export unused candidate/change-request functions; they should be removed with their modules rather than pruned one function at a time.

## Supabase client verdict

- `src/lib/supabase.js` is the sole client creator. It contains the only `createClient(...)`, the custom session/local storage adapter, configuration checks, and error mapping. Every live import points here.
- `src/lib/supabaseClient.js` only re-exports `./supabase` and has no imports. It creates no client and therefore no second session.
- Verdict: abandoned compatibility shim, safe to remove after one repository-wide import check. If a conventional filename is desired, rename in one atomic change; do not keep both indefinitely.

## Dependencies

No package can be labelled safely unused solely because it is not imported from `src/`:

| Dependency | Evidence of use | Verdict |
|---|---|---|
| `@supabase/supabase-js` | `src/lib/supabase.js` | live runtime |
| `lucide-react` | UI components | live runtime |
| `react`, `react-dom` | application entry/components | live runtime |
| `vite`, `@vitejs/plugin-react` | `vite.config.js`, build scripts | live build; they are in `dependencies` rather than `devDependencies`, which is packaging hygiene, not dead code |
| `tailwindcss`, `postcss`, `autoprefixer` | Tailwind/PostCSS configs and CSS build | live build |
| `vitest` | all tests | live test tooling |
| `supabase` CLI | not imported by JS; used only as development/deployment CLI convention | no package script proves current use. Confirm CI/developer commands before removing; confidence Low |

There is no PDF package. PDF generation is custom code in `src/utils/invoicePdf.js`; the performance audit should not assume a heavy PDF dependency.

## Duplicated logic and drift risk

### P1 — candidate field authorization is copied across four layers

The same policy is represented in `constants/pipeline.js` (`OPERATIONAL_FIELDS`, `PROTECTED_FIELDS`, `ADMIN_ONLY_CANDIDATE_FIELDS`), `App.jsx` (`extensionFields` routing), `CandidateDetailsDialog.jsx` (section field inventory), and SQL allowlists in two security-definer RPCs. These copies serve different enforcement layers, so some duplication is unavoidable, but there is no contract test proving they agree. The retention incident was exactly this kind of drift.

Removal impact: collapsing database enforcement into UI constants would break security. The right fix is a contract test/schema manifest that compares intended roles/fields with migration definitions, while retaining independent server enforcement. Confidence: High.

### P2 — live data access is split between services and inline `App.jsx`

Candidates, change requests, initial profile/team reads, interview lists, vacancy lists, and saved-view lists are implemented directly in `App.jsx`, while parallel service functions/hooks exist for many of them. Fixes made in the service can have no effect on production. For example, `candidateService.updateCandidateOperations` is cleanly wrapped but unused; `App.jsx` manually chooses among direct update and RPC paths.

Recommendation: choose one boundary. Moving the live calls behind services would shrink `App.jsx` and make RPC contracts testable. Until that refactor, delete dead wrappers to remove false authority. Confidence: High.

### P2 — interview enumerations are duplicated

`utils/interviews.js` exports status/confirmation constants, but `InterviewsPage.jsx` and `InterviewDialog.jsx` repeat status arrays inline. A new DB enum/check value can therefore appear in one dropdown but not another.

Recommendation: use the exported constants everywhere and add a migration-contract test. Removal impact: none if done carefully. Confidence: High.

### P2 — vacancy “days open” calculation is repeated

`VacanciesPage.jsx` computes the same `Date.now() - created_at` expression for table and detail. Time-zone and rounding changes can drift.

Recommendation: extract `getVacancyDaysOpen`. Removal impact: none; behavior becomes centralized. Confidence: High.

### P2 — date/time formatting and derivation are repeated

Candidate details, interview form, interview utilities, CSV paths, and vacancy UI each slice/construct dates independently. Interviews store `scheduled_date`, `scheduled_time`, and `scheduled_at`, with payload code expected to keep them aligned.

Recommendation: centralize date-only parsing/formatting and interview schedule derivation. Removal impact: risk is moderate because timezone behavior must be preserved. Confidence: High on duplication, Medium on exact consolidation design.

### P3 — demo visibility and active-candidate filtering have multiple owners

RLS excludes removed demo rows, `excludeRemovedDemoCandidates` filters again, `getCandidatesVisibleToProfile` applies role ownership, and `App.jsx` separately filters archived/active rows. Defense in depth is reasonable, but naming does not clearly distinguish security, demo removal, and archive presentation.

Recommendation: keep RLS authoritative and document each frontend filter's presentation purpose. Do not “deduplicate” away RLS. Confidence: High.

## RecruitOps naming still present

These should become Telora in active code/tests during a compatibility-aware cleanup:

- `src/services/askRecruitOpsService.js`, its test filename, `interpretRecruitOpsQuestion`, and `askRecruitOps` in `App.jsx`.
- Console text `RecruitOps vacancies query failed`.
- Test suite label `RecruitOps permissions`.
- `supabase/seed.sql` comment and the old migration comment. The applied migration must **not** be edited; only future docs/comments should use Telora.

These are internal persistence/channel identifiers and should not be casually renamed because doing so can discard local state or alter cross-tab behavior:

- `recruitops-theme`
- `recruitops-remember-session`
- `recruitops-auth`
- `recruitops-realtime`
- fallback project-ref string `recruitops`

If renamed, read/migrate the old storage keys for at least one release. Realtime channel naming is not customer-facing and can remain for compatibility.

These references are factual identifiers, not branding defects:

- package/repository name `recruitops`
- `docs/TELORA_MASTER_CONTEXT.md` statements naming the repository and the current service file
- historical migration comments (immutable under repository rules)

No remaining customer-facing visible string was found that calls the product RecruitOps.

## Removal sequence

1. Delete the three unreachable components, two hooks, and `supabaseClient.js`; run tests/build.
2. Decide whether services or `App.jsx` own data access, then remove the losing implementation.
3. Replace inline interview arrays with shared constants.
4. Add a cross-layer candidate-field permission contract test before any more permission work.
5. Rename active Ask service/symbols and console/test text, preserving storage/channel compatibility names.
