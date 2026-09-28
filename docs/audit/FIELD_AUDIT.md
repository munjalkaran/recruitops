# Telora field-use audit

Audit date: 2026-09-29. Static evidence sources: all migrations, `src/`, demo/mock data, imports, RPCs, filters, calculations, and rendered components. No production database was queried.

Classification follows the brief: **LIVE** = written, consumed by a calculation/filter/sort/condition, and surfaced; **DISPLAY-ONLY** = written and shown/editable but not consumed by logic; **WRITE-ONLY** = written but not surfaced (some are intentional control/audit metadata); **DEAD** = no meaningful application read or write beyond DDL/defaults. “Shown” includes an edit form. IDs and tenant keys are separately called out as control metadata because hiding them is correct.

## Highest-risk field findings

### P1 — organisation communication settings are editable placebo controls

`organisation_settings.display_name`, `email_signature`, and `default_email_template` are editable and persisted on Settings. Nothing outside that Settings form reads them. The app gets the organisation name from `organisations.name`, and the email draft path does not consume the saved signature/template. A user can carefully configure these fields and see no downstream change.

Recommendation: either wire each field into the visible product behavior and add tests, or remove/disable the controls with “not yet used” copy. Do not leave them looking operational.

### P1 — lifecycle milestone fields mostly record facts without driving work

The offer/joining fields `offer_status`, `offered_ctc`, `final_ctc`, `offer_date`, `offer_accepted_date`, `resignation_date`, `expected_joining_date`, `joining_risk`, and `joining_notes` are editable and displayed only in candidate detail. They do not create alerts, filters, stage transitions, dashboards, or follow-up work. The planned 16-stage lifecycle therefore has storage without workflow.

Recommendation: make the intended lifecycle explicit before adding more dates. At minimum, surface expected joining and high joining risk as actionable filters/alerts; otherwise label these fields informational.

### P1 — retention dates look authoritative but only status affects invoicing

`retention_period_days`, `retention_start_date`, `retention_due_date`, and `replacement_guarantee_end_date` are editable/displayed but do not drive invoice eligibility or another condition. Invoice eligibility uses `actual_joining_date + 90 days` plus `retention_status`. This creates two apparent clocks that can disagree.

Recommendation: choose one source of truth. Either derive/display the dates from actual joining plus the contractual period and use that derivation in invoicing, or explicitly label them informational. Keep `retention_status` because it has a real downstream effect.

### P2 — `invoice_eligibility_date` is intentionally orphaned but still populated

It is absent from the UI and business logic, yet demo enrichment/mock data continue to write it. The master context correctly says not to drop it casually, but continuing to populate it makes it look current to future maintainers and SQL users.

Recommendation: stop new writes, add a schema comment documenting compatibility-only status, and retain the column until a deliberate migration/retention decision.

### P2 — persistent candidate links are written but never loaded

`candidate_links` is written by the duplicate-link RPC, but `App.jsx` never queries the table. Duplicate detection is recomputed client-side and the persisted `link_type` is never used. Users can “link” records without that decision affecting future UI behavior.

Recommendation: load and honor persisted links (including returning-candidate semantics), or remove the Link action/RPC until persistence has an effect.

### P2 — stored actor/provenance data is ignored in timelines

`candidate_audit_log.actor_id` and `candidate_activity.actor_id` are stored but never joined to profiles. The UI therefore falls back to “Telora user.” Full `old_record`/`new_record` snapshots are also stored but not surfaced. This weakens accountability while retaining extra PII.

Recommendation: join actor names for admins, expose a controlled field-level audit view, and define retention/redaction for full snapshots.

## Candidates — every column

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `name`, `phone`, `email`, `current_employer`, `experience_years`, `target_bank`, `role`, `stage`, `owner_id`, `docs_status`, `fee`, `next_follow_up`, `last_contact`, `notes`, `is_archived`, `vacancy_id`, `current_ctc`, `expected_ctc`, `current_location`, `notice_period_days`, `actual_joining_date`, `document_checklist`, `retention_status`, `created_at`, `updated_at`, `is_demo` | Written through create/import/RPC/direct admin/demo paths. Consumed by identity/linkage, duplicate matching, grid search/filter/sort, stale detection, ownership, vacancy coverage, Ask Telora, invoice rules/totals, document progress, activity ordering, or demo UI; surfaced in grid/detail/system UI. Keep. |
| DISPLAY-ONLY | `relevant_experience`, `preferred_location`, `grade`, `last_working_date`, `past_client_association`, `source` | Editable and shown only in candidate detail. No calculation/filter/condition consumes them. Decide the operational question each answers, then add a filter/report, or label them informational. |
| DISPLAY-ONLY | `offer_status`, `offered_ctc`, `final_ctc`, `offer_date`, `offer_accepted_date`, `resignation_date`, `expected_joining_date`, `joining_risk`, `joining_notes` | Editable milestone data with no downstream workflow. Highest-risk traps are expected joining date and joining risk because users reasonably expect alerts. |
| DISPLAY-ONLY | `retention_period_days`, `retention_start_date`, `retention_due_date`, `replacement_guarantee_end_date` | Admin-editable and shown, but invoice logic ignores them. Align them with the single invoice clock or explicitly mark informational. |
| WRITE-ONLY (control/audit) | `organisation_id`, `archived_at`, `archived_by`, `created_by`, `demo_batch_id`, `demo_removed_at`, `demo_removed_by` | Written by RPCs/triggers/demo flows and read by RLS or database workflow, but not surfaced to users. Tenant/demo keys should remain hidden. Consider showing archive actor/time to admins; otherwise preserve as control metadata. |
| WRITE-ONLY compatibility | `invoice_eligibility_date` | Written by demo/mock enrichment only; neither displayed nor read. Stop new writes and document as compatibility-only. |

No candidate column is wholly untouched: every column is at least defined/defaulted and most are seeded or editable. The problem is not empty schema; it is authoritative-looking display-only data.

## Vacancies — every column

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `client_name`, `job_title`, `location`, `openings`, `priority`, `status`, `assigned_recruiter_id`, `created_at` | Written in vacancy form/demo seed; used for candidate linkage, recruiter/status/priority filters, coverage/health, Ask Telora, days-open calculation, and rendered views. Keep. |
| DISPLAY-ONLY | `job_description`, `minimum_experience`, `maximum_experience`, `minimum_ctc`, `maximum_ctc`, `client_hr_name`, `client_hr_email`, `client_hr_phone` | Editable; experience/CTC and HR name/email are shown in detail, while description and HR phone are only visible when editing. None drives matching, validation against candidates, outreach, or a filter. Wire to matching/contact workflow or label informational. HR phone and job description need a non-edit display if retained. |
| WRITE-ONLY (control) | `organisation_id`, `updated_at`, `is_demo`, `demo_batch_id`, `demo_removed_at` | Tenant/demo/update metadata is written and used by policies/sorting/removal but not deliberately surfaced. Keep; showing last updated may be useful but is not required. |

## Interviews — every column

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `candidate_id`, `vacancy_id`, `round_type`, `round_number`, `scheduled_date`, `scheduled_time`, `scheduled_at`, `timezone`, `mode`, `meeting_link`, `venue`, `panel_name`, `candidate_confirmation_status`, `interview_status`, `feedback_status`, `recommendation`, `rejection_reason`, `technical_fit_score`, `communication_score`, `role_fit_score`, `stability_motivation_score` | Written by schedule/feedback/reschedule/demo flows; consumed by schedule composition, validation, filters, attention rules, score averaging, line-up/export, or status conditions; surfaced in forms/tables/timeline. Keep. `scheduled_at` duplicates date/time but is the main sort/comparison value; define canonical derivation. |
| DISPLAY-ONLY | `panel_email`, `feedback_summary`, `internal_notes` | Editable and visible in forms, but no downstream action/filter uses them. Reasonable notes fields, but they should be labelled informational; panel email should feed the future draft/contact flow if kept. |
| WRITE-ONLY | `reschedule_reason`, `previous_interview_id`, `completed_at`, `feedback_received_at` | Written by reschedule/feedback flows but never surfaced or used in calculations. These can support valuable history/SLA metrics; expose them in interview history before users rely on them. |
| LIVE | `escalation_required`, `escalation_reason` | The no-show confirmation path writes both; attention logic reads and displays the resulting follow-up reason. Keep. |
| DEAD | `panel_user_id`, `escalation_owner_id` | Schema/validation/index only; no live source read or write. Remove only via a deliberate migration, or build user assignment before presenting escalation/panel ownership as a feature. |
| WRITE-ONLY (control) | `organisation_id`, `created_by`, `created_at`, `updated_at`, `is_demo`, `demo_batch_id`, `demo_removed_at` | Tenant/provenance/demo metadata. `created_at` can appear indirectly in activity fallback; other fields are correctly hidden but should be protected from recruiter rewrites (see security audit). |

## Profiles — every column

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `organisation_id`, `full_name`, `email`, `role`, `is_active`, `created_at` | Profile identity drives ownership, permissions, team counts/filtering, display names, and profile/team UI. Organisation ID is control data rather than literal UI but determines all access. Keep. |
| READ/DISPLAY WITHOUT WRITER | `avatar_url` | Rendered in profile/sidebar, but there is no live edit/upload path and profile self-edit is intentionally disabled. Either provide admin-managed avatar input/storage or remove the dormant image branch. |
| WRITE-ONLY metadata | `updated_at` | Trigger-maintained and fetched but not rendered or used. Keep only if future audit/sync needs it; otherwise harmless low-value metadata. |

## Remaining tables — every column

### `organisations`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `name`, `active_user_limit` | Tenant selection, organisation label, and team-cap UI/constraint consume them. |
| WRITE-ONLY/control | `slug`, `plan_code`, `is_active`, `created_at`, `updated_at` | Stored/defaulted but not surfaced or used by frontend business logic. `is_active` is especially misleading because access helpers do not check organisation activity. Either enforce it in `current_profile()` or stop implying it disables a tenant. `plan_code` should drive entitlements or be labelled bookkeeping. |

### `candidate_change_requests`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `candidate_id`, `requested_by`, `field_name`, `old_value`, `proposed_value`, `reason`, `status`, `review_comment`, `created_at` | Written/read/displayed by My Requests and Approvals, with status/field conditions. |
| WRITE-ONLY/control | `organisation_id`, `reviewed_by`, `reviewed_at`, `updated_at` | Stored provenance not surfaced. Show reviewer/time to admins and requesters or document retention-only purpose. |

### `candidate_audit_log`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `candidate_id`, `action`, `changed_fields`, `created_at` | Loaded, mapped, filtered, and shown in candidate activity. `changed_fields` only produces a generic “fields changed,” not the actual values. |
| WRITE-ONLY/audit | `organisation_id`, `actor_id`, `old_record`, `new_record` | Written on every RPC but not surfaced. Join actor identity and consider a secure diff view; full snapshots retain PII and need a retention policy. |

### `candidate_links`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| WRITE-ONLY | `id`, `organisation_id`, `candidate_id`, `linked_candidate_id`, `link_type`, `created_by`, `created_at`, `updated_at` | RPC writes the row, but frontend never queries the table. Persisted decisions have no product effect. Load/use them or remove the user-facing Link action until they do. |

### `organisation_settings`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| DISPLAY-ONLY | `display_name`, `email_signature`, `default_email_template` | Editable Settings controls; no branding/email path consumes them. These are direct user traps. |
| WRITE-ONLY/control | `id`, `organisation_id`, `created_at`, `updated_at` | Identity/tenant/timestamp metadata. |

### `demo_data_batches`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `status`, `created_at`, `removed_at`, `restored_at` | Demo status RPC returns these; UI uses status/batch identity and dates where available. |
| WRITE-ONLY/audit | `organisation_id`, `name`, `created_by`, `removed_by`, `restored_by` | Batch scoping/provenance is stored but actors/name are not surfaced. Keep for audit, optionally expose to admins. |

### `candidate_activity`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `candidate_id`, `activity_type`, `summary`, `metadata`, `created_at` | Loaded and mapped to timeline; metadata stage affects detail text. |
| WRITE-ONLY/audit | `organisation_id`, `actor_id` | Tenant/actor stored; actor is not resolved for display. Join actor names or remove false “Telora user” implication. |

### `saved_views`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `id`, `organisation_id`, `owner_id`, `name`, `page`, `filters`, `updated_at` | Created/loaded/deleted; filters drive pipeline presentation; owner/page/policy scope and updated sort are active. |
| DEAD/placeholder | `is_shared` | Always written `false`; no toggle or shared-view UI. RLS mentions it only for admin visibility. Either implement sharing semantics or remove it later. |
| WRITE-ONLY metadata | `created_at` | Stored but not surfaced or used. Harmless, low value. |

### `billing_settings`

| Classification | Columns | Evidence and recommendation |
|---|---|---|
| LIVE | `organisation_id`, `legal_name`, `billing_address`, `gstin`, `payment_instructions`, `payment_terms`, `invoice_prefix` | Editable in Settings and consumed by invoice warnings/PDF/number generation. Keep and validate formats as needed. |
| DEAD | `pan` | No Settings input, PDF output, condition, or test consumes it. Decide whether invoices legally/operationally need it; then wire it end-to-end or remove in a future migration. |
| WRITE-ONLY metadata | `updated_at` | Trigger/default timestamp fetched but unused. |

## Reverse audit: logic reading fields with no reliable write

1. **Avatar:** `avatar_url` is rendered but has no product writer; only database/bootstrap operations could populate it.
2. **Organisation active flag:** if the intended logic is “inactive organisations cannot use Telora,” that logic is missing entirely; the field is written/defaulted but never read by `current_profile` or frontend access control.
3. **Scheduled time duplication:** business logic prefers `scheduled_at`, while the form writes date/time and payload construction also derives `scheduled_at`. Any external/import writer that changes only one representation can create conflicting UI. Establish one canonical value and derive the others.

## Recommended decision order

1. Wire or remove the three organisation communication placebo controls.
2. Decide the single retention/invoice clock before adding more lifecycle dates.
3. Turn expected joining/joining risk into actionable filters/alerts or label the entire milestone block informational.
4. Make candidate links durable in the UI or stop writing them.
5. Resolve stored actor IDs into the audit timeline and set retention for snapshot PII.
