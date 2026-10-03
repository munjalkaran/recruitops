# Design: 16-stage recruitment lifecycle

Design date: 2026-09-29. This is a design proposal only. It does not modify application code or migrations.

## Evidence result: the complete list is not in the repository

A repository-wide search found the two endpoints and the number 16, but no trusted full 16-stage list. The only direct statement is:

> “The product owner's 16-stage lifecycle model (Company Requirement → ... → Payment Received) is the reference model the pipeline is evolving toward”

— `docs/TELORA_MASTER_CONTEXT.md:94`

The roadmap repeats only the count:

> “16 lifecycle milestone date fields — current code still has the 10-stage PIPELINE_STAGES list and does not implement those milestone fields”

— `docs/TELORA_MASTER_CONTEXT.md:127`

The older project brief gives a seven-step business flow, verbatim:

> “1. Source candidate resumes … 2. Team calls candidates … 3. Interview rounds with the bank. 4. Documentation collected from the candidate. 5. Candidate joins the bank. 6. At month-end, an invoice is raised … 7. Agency gets paid.”

— `docs/recruitment-tool-project-brief.md:25-32`

It also records the current ordered pipeline:

> `Sourced → Contacted → Screened → Interviewing → Selected → Documentation → Joined → Invoiced → Paid`, plus `Dropped` (a lost state).

— `docs/recruitment-tool-project-brief.md:89-93`

The source of truth in code is identical:

```text
Sourced, Contacted, Screened, Interviewing, Selected,
Documentation, Joined, Invoiced, Paid, Dropped
```

— `src/constants/pipeline.js:1-12`

The code defines `Interviewing` only as:

> “An interview is scheduled or interview rounds are in progress.”

— `src/constants/pipeline.js:163-164`

The interview schema supplies possible sub-stages, but not a lifecycle order:

```text
TP1, TP2, Client, HR, Other
```

— `supabase/migrations/202607310002_interviews.sql:9`

The candidate schema supplies the late-stage evidence:

```text
offer_date, offer_accepted_date, resignation_date,
expected_joining_date, actual_joining_date,
retention_start_date, retention_due_date, retention_status,
replacement_guarantee_end_date, invoice_eligibility_date
```

— `supabase/migrations/202608010002_candidate_workflow_and_retention.sql:8-21`

Important permission evidence:

> “actual_joining_date deliberately remains recruiter-editable because recruiters are the ones who confirm joining.”

— `docs/TELORA_MASTER_CONTEXT.md:35`

> “Five retention fields are now admin-only”

— `docs/TELORA_MASTER_CONTEXT.md:35`

Conclusion: presenting any middle 14 stages as “the product owner's list” would be fabrication. The remainder of this document is explicitly a proposal derived from current behavior.

## Proposed 16-stage list — not found text

The labels below preserve all current stages except the generic `Interviewing`, split the interview workflow using existing round types, and expand the existing offer/retention/billing fields. `Dropped` remains an off-ramp, not one of the 16 success-path stages.

| # | Proposed stage | Basis | Proposed logical date column and canonical table | Type | Write authority |
|---:|---|---|---|---|---|
| 1 | **Company Requirement** | **FOUND endpoint**; vacancy model exists | `vacancies.requirement_received_date` | `date` | Admin-only |
| 2 | **Sourced** | **FOUND current stage** | `candidates.sourced_date` | `date` | Recruiter may set for owned candidate; admin |
| 3 | **Contacted** | **FOUND current stage** | `candidates.contacted_date` | `date` | Recruiter owner; admin |
| 4 | **Screened** | **FOUND current stage** | `candidates.screened_date` | `date` | Recruiter owner; admin |
| 5 | **TP1 Interview** | **PROPOSED from existing `TP1` round** | projected `tp1_interview_date` from `interviews.scheduled_date`/`completed_at` | `date` | Not directly editable on candidate; recruiter/admin through interview workflow |
| 6 | **TP2 Interview** | **PROPOSED from existing `TP2` round** | projected `tp2_interview_date` from interviews | `date` | Through interview workflow |
| 7 | **Client Interview** | **PROPOSED from existing `Client` round** | projected `client_interview_date` from interviews | `date` | Through interview workflow |
| 8 | **Selected** | **FOUND current stage** | `candidates.selected_date` | `date` | Recruiter owner; admin |
| 9 | **Documentation** | **FOUND current stage/checklist** | `candidates.documentation_started_date` | `date` | Recruiter owner; admin |
| 10 | **Offer Released** | **PROPOSED from `offer_date`/`Offered`** | reuse `candidates.offer_date` | `date` | Recruiter owner; admin |
| 11 | **Offer Accepted** | **PROPOSED from existing field** | reuse `candidates.offer_accepted_date` | `date` | Recruiter owner; admin |
| 12 | **Resignation Confirmed** | **PROPOSED from existing field/proof** | reuse `candidates.resignation_date` | `date` | Recruiter owner; admin |
| 13 | **Joined** | **FOUND current stage/field** | reuse `candidates.actual_joining_date` | `date` | Recruiter owner; admin, as already decided |
| 14 | **Retention Completed** | **PROPOSED from retention status** | `candidates.retention_completed_date` | `date` | Admin-only |
| 15 | **Invoice Raised** | **PROPOSED expansion of `Invoiced`** | `candidates.invoice_raised_date` initially; later invoice record date | `date` | Admin-only |
| 16 | **Payment Received** | **FOUND endpoint; expands `Paid`** | `candidates.payment_received_date` initially; later payment record date | `date` | Admin-only |

### Why these names and columns

- Existing business dates use snake_case plus `_date`, and business milestones are `date`, not `timestamptz`.
- “Documentation” uses `documentation_started_date`, not “completed,” because the current stage means documents “are being collected, checked or submitted” (`src/constants/pipeline.js:166`). If the owner means completion, both label and date must change.
- The three interview dates should be derived from the canonical `interviews` rows. Copying them onto candidates creates two authorities that will disagree after reschedules/no-shows. A database view such as `candidate_lifecycle` can expose all 16 date columns without duplicating those dates.
- Company Requirement belongs to a vacancy. Copying one requirement date onto every candidate linked to that vacancy is denormalized and becomes wrong if a candidate changes vacancy.
- `retention_due_date` is an expected deadline, not proof of completion. A new `retention_completed_date` is required if stage 14 means actual completion.
- `invoice_eligibility_date` must not be repurposed as invoice raised date; it is deliberately compatibility-only and not used by the current calculation.
- A future invoice/payment table would be more correct than candidate columns because one invoice can contain multiple candidates and payments can be partial. Candidate dates are an interim lifecycle projection, not an accounting ledger.

### What about HR Interview and Dropped?

The schema supports an `HR` interview round, but including TP1, TP2, Client, and HR would make 17 stages with the proposal above. Product confirmation is required: HR might replace TP2, be folded into Client Interview, or displace another proposed stage.

`Dropped` is not a success-path milestone between requirement and payment. Keep it as an exception state available from stages 2–13, and add separate `dropped_date`/`drop_reason` only if reporting needs them. Do not pretend Dropped is “stage 17.”

## Mapping the current 10 stages

| Current stage | Proposed position | Backward mapping rule |
|---|---:|---|
| Sourced | 2 — Sourced | direct |
| Contacted | 3 — Contacted | direct |
| Screened | 4 — Screened | direct |
| Interviewing | 5, 6, or 7 | choose the most advanced qualifying TP1/TP2/Client interview row; if none exists, map temporarily to TP1 Interview and flag for review |
| Selected | 8 — Selected | direct |
| Documentation | 9 — Documentation | direct |
| Joined | 13 — Joined | direct; actual date may still be missing and must be flagged, not invented |
| Invoiced | 15 — Invoice Raised | direct state mapping; date comes only from audit evidence or remains null |
| Paid | 16 — Payment Received | direct state mapping; date comes only from audit evidence or remains null |
| Dropped | exception/off-ramp | retain outside the numbered success path |

There is no honest mapping from an existing candidate to Company Requirement, Offer Released/Accepted, Resignation, or Retention Completed merely because its current stage is later. Later state suggests those events may have happened, but it does not prove when—or always that they happened.

## Recommended data shape

### Do not add 16 duplicate columns to `candidates`

Expose 16 logical columns through a `candidate_lifecycle` view (or RPC projection), while keeping each fact in its natural canonical record:

- Vacancy requirement date on `vacancies`.
- TP1/TP2/Client dates derived from `interviews` using a defined qualifying status.
- Candidate-owned sourcing/contact/selection/docs/offer/resignation/joining/retention milestone dates on `candidates`.
- Invoice/payment dates eventually derived from durable invoice/payment records.

The view provides reporting/CSV/filter consistency without letting a candidate date contradict a rescheduled interview or changed vacancy.

### Stage and date update contract

Replace arbitrary independent stage/date edits with one guarded RPC such as `advance_candidate_lifecycle(candidate_id, target_stage, milestone_date)`. It must:

- explicitly reject a null/inactive actor;
- lock the candidate;
- enforce organisation and owner/admin authority positively;
- use a literal stage-to-date allowlist;
- make retention/invoice/payment transitions admin-only;
- reject impossible dates if the ordering rules are agreed;
- record old/new stage and date in the audit log;
- preserve historical milestone dates when the current stage moves backward unless an admin explicitly corrects one.

The allowlist is a second security boundary and must be contract-tested against the UI constants.

## Migration and rollout plan

Use **several migrations/deploys**, not one big migration. The app, saved views, imports, and current rows need a compatibility window.

1. **Decision freeze (no migration):** approve exact labels/order, stage-entry versus stage-completion meaning, interview qualification, Dropped behavior, and accounting semantics.
2. **Additive foundation migration:** add `vacancies.requirement_received_date`; add the missing candidate date columns; add a lifecycle projection view; add indexes only for dates used in filters; expand the stage check to accept both old and new labels plus Dropped. Do not remove old values.
3. **Security/RPC migration:** create the explicit lifecycle RPC and grants/revokes; fix the P0 null-actor flaw at the same time or earlier; add database role/allowlist tests.
4. **Dual-compatible app deploy:** understand both old and new stage labels, write only new labels through the RPC, version saved views, and keep imports compatible.
5. **Evidence-based backfill migration:** populate dates only from auditable sources, translate current stage values, and emit a review report for ambiguous/missing dates.
6. **Feature deploy:** new grouped lifecycle UI, filters, Ask Telora vocabulary, CSV version, demo data, invoice rule, tests.
7. **Constraint-tightening migration:** only after zero old labels remain, replace the transitional stage check with the final set. Remove compatibility aliases later, not in the first release.

The additive columns and view can technically be one migration. Backfill and constraint tightening should be separate so each is reviewable, observable, and recoverable.

## Concrete backfill rules

Never use `updated_at` as a milestone date: unrelated edits change it. Never fill every earlier date merely because a candidate is at a later stage.

1. **Requirement:** use an existing business-provided requirement date if one can be imported. If none exists, either leave null or—only with owner approval—use `vacancies.created_at::date` marked/documented as an inferred proxy.
2. **Sourced:** prefer the earliest audit `created` event date. `candidates.created_at::date` is an acceptable record-created proxy if the owner agrees that creation equals sourcing.
3. **Contacted, Screened, Selected, Documentation:** use the earliest audit row whose `new_record->>'stage'` equals that stage. If historical audit is absent, leave the date null.
4. **TP1/TP2/Client:** derive from the earliest qualifying interview row for that round. Decide whether “qualifying” means Scheduled, Completed, or Feedback Received. Rescheduled/cancelled/no-show rows must not silently count unless explicitly intended.
5. **Offer/acceptance/resignation/joining:** preserve existing `offer_date`, `offer_accepted_date`, `resignation_date`, and `actual_joining_date`. Do not synthesize missing dates from stage.
6. **Retention completed:** set only when there is trustworthy evidence of `retention_status='Completed'`; existing `retention_due_date` is not proof of completion. If no event timestamp exists, leave null for admin review.
7. **Invoice raised/payment received:** use the earliest audit transition to `Invoiced`/`Paid`. Current stage can map to the new current-stage label, but without audit evidence the milestone date remains null.
8. **Current stage translation:** apply the table above. `Interviewing` without usable interview history becomes a flagged manual-review case.
9. **Quality report:** count rows by mapping source (`exact existing date`, `audit derived`, `proxy`, `unknown`) and do not tighten constraints until unknowns are accepted.

## UI impact

Sixteen permanent date columns should **not** be added to the pipeline grid.

- Keep the grid focused on candidate, vacancy, current stage, owner, next action, actual joining date, and selected operational columns.
- Replace 16 dashboard chips with 5–6 phase chips: Demand, Sourcing, Interviews, Offer & Documents, Joining & Retention, Billing. A phase opens stage-specific counts/filters.
- Show a compact current-stage cell containing stage, milestone date, and “next expected milestone.” Preserve stage-rank sorting.
- Put the full lifecycle in Candidate Detail as a vertical stepper/timeline grouped by phase. Show date, source, actor, and whether it is inferred or confirmed.
- Add a generic filter: `Milestone` selector + `before/after/missing` date condition. Reuse the existing column-filter engine concept without rendering 16 columns.
- Offer an optional “Lifecycle dates” column preset or side panel for admins, not the default recruiter grid.
- Export the 16 logical dates in an explicit “Expanded lifecycle CSV,” while keeping the familiar standard export compact.
- Treat Dropped as a visible off-ramp badge with the last reached success milestone, rather than forcing it into the success sequence.

## What breaks and required changes

### Invoice eligibility

Current logic requires `stage === 'Joined'`. Once a candidate advances to Retention Completed, Invoice Raised, or Payment Received, that test becomes wrong. Eligibility should be based on facts: active/not dropped or archived, actual joining date + agreed wait, billable retention state, and no invoice-raised record/date. Marking invoiced should atomically set Invoice Raised and its date; Payment Received must not re-enter the queue.

### Saved views

Saved filters store literal stage labels. Version the saved-view shape, map old labels on load, and translate `Interviewing` to an interview phase filter rather than guessing one sub-stage. Preserve unknown filters for rollback; do not silently discard users' views.

### CSV import/export

- Continue accepting the 10 old labels during a compatibility period and map them deterministically.
- Add a lifecycle schema/version header or separate expanded template.
- Validate milestone date order and role permissions on import; recruiter imports must not write admin-only retention/invoice/payment dates.
- Do not export derived interview/requirement dates as though they are candidate-owned editable fields; document their source.
- Avoid making 16 new columns mandatory for a valid import.

### Ask Telora

The interpreter matches the current `PIPELINE_STAGES` strings. Update synonyms and queries for phase/stage counts, missing milestones, expected joining, retention, invoice raised, and payment received. It must distinguish “interview scheduled” from “interview completed” and should query the lifecycle projection rather than infer from labels alone.

### Demo seed and mock data

Update SQL seed enrichment and all three mock collections together. Seed at least one record at every phase, explicit TP1/TP2/Client interviews, missing-date exceptions, one dropped candidate, retention failed/replacement cases, invoice raised, and payment received. Dates must be internally ordered. Remove the current misleading write to compatibility-only `invoice_eligibility_date`.

### Additional breakpoints

- Stage database check constraint and both stage allowlists.
- `CLOSED_STAGES`, stale-follow-up behavior, stage styles/definitions/rank sorting, summary counts, route chips, permissions tests, source-string UI contracts, and migration tests.
- Existing `offer_status`, `docs_status`, `retention_status`, and current stage can conflict. Define which is authoritative and add consistency checks or derive one from the other.
- Vacancy health and interview pages currently use candidate stage names such as `Interviewing` and `Selected`.
- Realtime and audit displays need the new stage names/date changes without triggering full-world refetches.

## Prompt-sized implementation sequence

1. **Glossary/decision prompt:** finalize the 16 names, order, semantics, owner, and exception states; update design docs only.
2. **Database foundation prompt:** additive date columns, requirement date, lifecycle view, transitional stage constraint, indexes, SQL tests. Migration point 1.
3. **Security/RPC prompt:** P0 actor guard plus lifecycle transition RPC and explicit role/field allowlist. Migration point 2.
4. **Backfill-analysis prompt:** read-only report using audit/interview evidence; owner reviews ambiguity counts.
5. **Backfill prompt:** evidence-based date fill and stage translation with verification queries. Migration point 3.
6. **Core lifecycle UI prompt:** shared constants, grouped phase navigation, stage cell, detail timeline, generic milestone filter.
7. **Compatibility prompt:** saved-view versioning, CSV old/new mapping, Ask Telora vocabulary, invoice eligibility rewrite.
8. **Demo/tests prompt:** seed/mock updates, database role tests, unit/component/E2E coverage.
9. **Cutover prompt:** verify no old stage values, tighten constraint, remove transitional writes. Migration point 4.

## Questions that must be answered before building

1. What is the product owner's exact 16-stage list, spelling, and order? Please supply it verbatim; should any proposed label above be replaced?
2. Does a milestone date mean the date a stage **started**, the date it **completed**, or the real-world event date? This especially changes Documentation and interviews.
3. Is Company Requirement a vacancy-level event shared by candidates, or must each candidate snapshot its own requirement date?
4. Which interview rounds are lifecycle stages: TP1, TP2, Client, HR, all four, or a configurable subset? What happens when a role skips a round or repeats one?
5. Does an interview stage count when scheduled, completed, or only when feedback is received? How should No Show, Cancelled, and Rescheduled affect it?
6. Is Documentation before Offer Released, after Offer Accepted, or allowed to overlap? Does its date mean started or completed?
7. Should stages auto-advance from interview/offer/joining/invoice facts, or can users manually select any stage? If both disagree, which wins?
8. May recruiters backdate/correct milestone dates directly, or must corrections after first entry be admin-approved?
9. Confirm that stages 14–16—Retention Completed, Invoice Raised, Payment Received—are admin-only. Is any retention update ever recruiter-owned?
10. Is retention complete on the due date automatically, or only after an admin confirms the candidate remained employed? What does Replacement Required do to the current lifecycle stage?
11. Does invoice eligibility remain a fixed 90 days after actual joining, or should `retention_period_days` control it per placement/client?
12. Can one candidate placement appear on multiple invoices, receive partial payments, or be credited/replaced? If yes, dates on `candidates` are insufficient and invoice/payment tables are required now.
13. Should Dropped be possible from every pre-joining stage? Do you need `drop_reason`, `dropped_date`, and reopen history?
14. For old data, may `created_at` stand in for sourced/requirement dates, or must unknown milestone dates stay blank?
15. How should existing generic `Interviewing` candidates with no interview rows be mapped—TP1, an “Interview phase” compatibility state, or manual review?
16. Must existing CSV templates and saved views remain backward compatible indefinitely, or is a versioned cutover acceptable?
17. Which lifecycle dates must appear in the default grid, standard CSV, reports, and Ask Telora? “All 16 everywhere” will make the core workflow worse.
18. Should the lifecycle be globally fixed or configurable per organisation/client vacancy? The current schema has role-specific round types, which suggests variation.
