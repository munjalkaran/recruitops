# Telora bundle and performance audit

Audit date: 2026-09-29. `pnpm build` completed successfully with Vite 5.4.21: 1,687 modules transformed in 1.43 s.

## Production build result

| Asset | Minified | Gzip |
|---|---:|---:|
| `dist/assets/index-DjEnJw3_.js` | 609.09 kB | 165.57 kB |
| `dist/assets/index-tukdsr09.css` | 40.30 kB | 8.19 kB |
| `dist/index.html` | 0.74 kB | 0.41 kB |

Vite correctly warns that the JS chunk exceeds 500 kB. The total compressed shell is about 174 kB before candidate/interview/audit API data.

## What is in the bundle

Rollup `renderedLength` is pre-final-minification and cannot be summed into the 609 kB output, but it reliably identifies contributors:

| Contributor | Rendered bytes | Observation |
|---|---:|---|
| Supabase JS family, aggregate | ~798,860 | dominant dependency family: auth, PostgREST, storage, realtime, functions, Phoenix |
| `@supabase/auth-js/GoTrueClient.js` | 256,280 | largest single module |
| React DOM production | 133,325 | expected framework cost |
| `@supabase/postgrest-js` | 106,076 | core database API |
| `@supabase/storage-js` | 106,068 | bundled although Telora has no storage feature today |
| `src/App.jsx` | 62,275 | all routes/data orchestration in one module |
| Supabase Phoenix | 56,053 | realtime transport |
| Supabase root client | 36,896 | client facade |
| Supabase Auth admin API + WebAuthn | ~69,500 combined | features not visibly used by Telora but included through the client |
| `CandidateGrid.jsx` | 30,961 | core page, reasonable to keep eager |
| `CandidateDetailsDialog.jsx` | 22,790 | could load with the pipeline/detail action |
| `InterviewsPage.jsx` + `InterviewDialog.jsx` | 34,101 | route-level split candidate |
| `VacanciesPage.jsx` | 21,199 | route-level split candidate |
| mock/demo JS data | ~20,653 aggregate | production bundle includes mock candidates, vacancies, and interviews |
| Lucide icons, aggregate | ~30,131 | tree-shaken individual icons; not a barrel catastrophe |

The installed Supabase dependency resolves to 2.110.7 because `package.json` uses `^2.48.1`. Its `createClient` facade constructs auth, storage, functions, PostgREST, and realtime clients, so ordinary tree-shaking cannot remove all unused product areas.

## Lazy-loading opportunities

These figures are experimental gzip sizes from a read-only Vite manual-chunk analysis. True `React.lazy` results will differ because shared React/icon/util modules remain in the base chunk. Lazy loading reduces initial bytes, not total bytes.

| Candidate | Approximate deferred gzip | Recommendation |
|---|---:|---|
| Interviews page/dialog/utilities | ~6.4 kB | `React.lazy` by route; strong clean boundary |
| Vacancies page | ~4.1 kB | lazy by route |
| Administration Settings + Demo manager | ~4.4 kB | lazy; admin-only and infrequent |
| Production mock/demo data | ~4.0 kB | do not ship eagerly; dynamic-import only in development/demo mode |
| Invoicing page + PDF generator | likely 5–10 kB | lazy admin route; manual split over-counted shared dependencies |
| Ask panel + deterministic interpreter | likely 3–6 kB | lazy on first “Ask Telora” open |
| Team, approvals, archived/detail dialogs | likely 5–10 kB combined | group as admin/secondary route chunks after measuring |

Splitting the obvious secondary/admin routes should remove roughly 25–40 kB gzip from the first load and, more importantly, bring the raw entry chunk below Vite’s warning threshold. `CandidateGrid` and the overview shell are primary daily paths and should stay eager.

## PDF answer

There is **no PDF library dependency**. `src/utils/invoicePdf.js` hand-builds a one-page PDF and contributes only ~3,178 rendered bytes. It is statically imported by `App.jsx`, so it is loaded on every page, but it is not the cause of the 609 kB chunk. Lazy-load it with the invoicing route for hygiene; do not rank it above Supabase/data-fetch work.

The current generator has a separate correctness/scale issue: it has one fixed page and clamps later rows near the bottom, so a long invoice can overlap rather than paginate. That belongs in the backlog even though its bundle cost is small.

## Data fetching and computation

### P1 — every initial load fetches the entire application

`refreshData` launches 12 queries in parallel, which avoids a network waterfall, but most use `select("*")` with no range/limit:

- organisation and organisation settings
- every profile
- every RLS-visible candidate, with every column
- every visible correction request
- every vacancy plus `candidates(id)`
- every interview
- every candidate audit row
- every candidate activity row
- every saved view
- billing settings
- admin demo status RPC

Admins therefore download the full candidate table plus all audit/activity history before any route is useful. Audit snapshots include full old/new candidate JSON, multiplying payload and PII transfer. Vacancies also request linked candidate IDs even though the complete candidate collection is already loaded.

Recommendation: fetch a narrow overview/pipeline projection first; load route data on demand; paginate candidates and especially audit/activity; fetch history only when a candidate detail opens.

### P1 — each realtime event triggers the same 12-resource refetch

Any insert/update/delete on candidates, correction requests, profiles, or interviews calls full `refreshData()`. A CSV import of N rows can emit N events; an invoice batch can emit one per candidate; concurrent users can create overlapping refreshes. There is no debounce, abort, coalescing, or direct payload reconciliation.

Recommendation: apply realtime payloads to the affected collection, invalidate only dependent queries, or debounce/coalesce to one targeted refresh. At minimum, do not refetch billing/settings/saved views/audit/activity for an interview update.

### P1 — sequential N+1 writes for CSV import and invoicing

- CSV import loops over rows and awaits one `create_candidate` RPC per row. A failure halfway leaves a partial import.
- Mark-as-invoiced loops over eligible candidates and awaits one direct update each. A failure halfway leaves a partial invoice batch.

Recommendation: database RPCs accepting validated arrays, with one transaction and a structured per-row/result contract. This improves speed and fixes data-integrity risk.

### P2 — duplicate detection is quadratic in the browser

On every candidate/profile collection change, the app calls `findDuplicateWarnings(candidate, candidates, profiles)` for every candidate. That compares all pairs and may run name-similarity work: O(n²). CSV preview then compares every imported row against the full set again.

Recommendation: index normalized phone/email maps for exact matches, then run fuzzy name matching only on a narrowed bucket or server-side candidate set.

### P2 — client filtering requires all rows

Search, stage/recruiter filters, sorting, stale selection, Ask Telora, invoice eligibility, and vacancy coverage all operate over the in-memory full candidate list. This is fast for tens of rows but prevents pagination and degrades on the slow devices/network the product targets.

Recommendation: preserve client-side spreadsheet feel for a bounded working set, but add server filters/pagination for archive, audit, and large organisations. Measure the crossover before moving every interaction server-side.

### P3 — unnecessary production mock code

Static imports of mock candidates/vacancies/interviews survive the production build even though fallback is development-only by intent. Dynamic `import()` behind a compile-time development/demo branch removes about 4 kB gzip and avoids shipping fake personal-looking records.

## Slow Indian mobile estimate

This is an engineering estimate, not a field measurement.

- On a constrained 400 kbps connection (about 50 kB/s usable) with 600–1,000 ms latency, the 174 kB compressed shell alone needs roughly 3.5 s transfer. DNS/TLS/request latency plus parse/compile/render on a low-end Android device plausibly makes the shell interactive in **5–8 seconds**.
- The current 12-query data load can add several hundred kB as candidates and full audit snapshots grow. Even in parallel, Supabase latency, transfer, JSON parsing, duplicate O(n²), and React rendering can move useful-data readiness to **7–12+ seconds** for an admin dataset.
- On a reasonable 1 Mbps slow-4G connection, a small current dataset is more likely **3–5 seconds** to shell and **4–8 seconds** to useful data.

The estimate should be replaced with WebPageTest/Lighthouse on a throttled low-end mobile profile and real anonymized row counts.

## Three highest-impact fixes

1. **Targeted, paginated data loading plus realtime reconciliation:** narrow selects, route/detail fetches, lazy audit/activity, and event-specific cache updates. This attacks network, database, JSON, render, and realtime amplification together.
2. **Route/feature code splitting and development-only mock imports:** lazy Interviews, Vacancies, Administration, Invoicing/PDF, Ask, and admin-only pages. This is the fastest path below the single-chunk warning and saves an estimated 25–40 kB gzip on first load.
3. **Transactional bulk RPCs and indexed duplicate detection:** replace sequential CSV/invoice writes and O(n²) comparisons. This improves scale while eliminating partial financial/import state.

## Verification after changes

- Track entry JS gzip, per-route chunks, and long-task time in CI.
- Measure overview/pipeline first-content and useful-data times at 400 kbps/4× CPU slowdown.
- Record query count and transferred JSON bytes for admin/recruiter at 100, 1,000, and 10,000 candidates.
- Simulate a 100-row import and realtime event burst; assert one bounded refresh and atomic result.
