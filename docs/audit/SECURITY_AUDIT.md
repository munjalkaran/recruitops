# Telora privileged-path security audit

Audit date: 2026-09-29. Scope: the migration chain through `202609280001_restrict_retention_invoice_fields_to_admin.sql` and call sites under `src/`. This is static analysis only. No live Supabase connection was made. PostgreSQL's default function privileges were treated as part of the attack surface; later `REVOKE` statements were applied when deriving effective access.

## Executive result

The retention-field hole described in the brief is fixed in the latest definition of `update_candidate_profile_extensions`: recruiters can no longer send the five admin-managed retention fields. However, the same RPC, `update_candidate_operations`, and `archive_candidate` have a different P0: they do not explicitly reject a null `current_profile()`. In PL/pgSQL an `IF` condition that evaluates to `NULL` does not enter the rejection branch. An authenticated Auth user with no active profile (including a deactivated recruiter whose Auth session/token is still usable) can therefore call these `SECURITY DEFINER` functions with a known candidate UUID and bypass organisation/owner checks.

The minimum safe pattern for every externally callable definer RPC is an explicit first guard such as `if actor.id is null then raise exception 'Permission denied'; end if;`, followed by positive checks. A future migration should replace null-sensitive negative comparisons with positive authorization conditions.

## Ranked findings

### P0 — inactive or unprovisioned authenticated users can mutate candidates

- Affected latest definitions: `update_candidate_operations` (`202609130001`), `update_candidate_profile_extensions` (`202609280001`), and `archive_candidate` (`202607220003`). All are granted to `authenticated`.
- Root cause: `current_profile()` returns no row when `p.is_active` is false or no profile exists. Composite fields such as `actor.organisation_id`, `actor.role`, and `actor.id` then evaluate to `NULL`. Expressions such as `old_row.organisation_id <> actor.organisation_id` and `actor.role <> 'admin'` also become `NULL`; `IF NULL THEN RAISE` does not raise.
- Exploit: keep or obtain an authenticated Supabase session for an Auth user whose profile is absent/inactive, learn a candidate UUID (for example from a previously visible record or browser history), then call `rpc('update_candidate_operations', {p_candidate_id: UUID, p_updates: {stage: 'Paid'}})`, `update_candidate_profile_extensions` with an allowed key, or `archive_candidate`. The definer owner performs the write despite RLS.
- Business consequence: removing a recruiter's application access does not reliably remove write access; candidate workflow, joining, salary/CTC, document, or archive state can be altered after deactivation, including across organisations if a UUID is known.
- Fix size: one prompt plus a migration and negative RPC tests. Migration required: yes.

### P1 — audit-event RPCs have the same null-profile authorization pattern

`record_email_draft_opened` and `record_duplicate_warning_dismissed` can be called by an authenticated user without an active profile for any known candidate UUID. They do not modify the candidate, but they can insert misleading audit records with a null actor. The duplicate-dismiss RPC also accepts an arbitrary unvalidated `p_linked_candidate_id` in audit metadata. Use the same explicit actor guard and validate both candidate IDs.

### P1 — the latest `create_candidate` lost owner validation

`202607220003` checked that `owner_id` was an active recruiter in the actor's organisation. `202607310001` redefined the function and omitted that check while adding vacancy/profile fields. An admin can now create an organisation-A candidate whose `owner_id` references a profile in organisation B. The foreign key validates existence, not tenant membership. This is admin-triggered rather than recruiter-triggered, but it breaks tenant integrity and can make ownership-based visibility nonsensical. Reinstate the earlier owner check in a new migration.

### P1 — approved owner correction can cross organisation boundaries

`review_candidate_change` casts the proposed `owner_id` and writes it without checking that the target is an active recruiter in the candidate's organisation. A recruiter who knows another profile UUID can propose it; an admin approval then creates the cross-tenant link. Validate the target at request time and again atomically at approval time.

### P2 — interview update policy allows audit/authorship fields to be rewritten

For an owned, non-archived candidate, `interviews_update_scoped` permits a recruiter to update any granted column, not just scheduling/feedback fields. Its `WITH CHECK` does not freeze `created_by`, `created_at`, `demo_batch_id`, `is_demo`, or `demo_removed_at`. A direct REST update could therefore falsify authorship or demo provenance. Use column-level privileges or an RPC/trigger that restricts mutable fields.

### P2 — JSON shape and no-op calls are insufficiently constrained

- `update_candidate_profile_extensions` accepts any JSON value for `document_checklist`; an array, string, or number can replace the expected object and break downstream UI assumptions.
- Empty objects are accepted by both candidate-update RPCs. The profile-extension path still executes an update and writes an audit event; repeated no-op calls can create misleading activity/noise.
- `null` JSON usually becomes a no-op because key tests become null; array/scalar input to `jsonb_object_keys` errors. These fail closed but produce inconsistent client errors.
- `past_client_association` accepts PostgreSQL boolean text coercions rather than a strict JSON boolean. Numeric/date fields rely on casts and table constraints, which reject malformed values but do not yield a stable RPC contract.

### P2 — dead direct grant surface on RLS helper functions

`current_profile`, `current_organisation_id`, and `current_app_role` are granted to `authenticated` and have no `src/` RPC call sites. They are not truly dead: RLS policies call them. Direct client execution is unnecessary, however, and exposes implementation helpers as RPC endpoints. Test whether PostgREST/RLS continues to operate after removing the explicit client grant; if so, revoke direct authenticated execution in a migration.

### P3 — duplicate-link API permits cross-owner link metadata

`link_candidate_records` requires ownership only of the first candidate. A recruiter who knows a second same-organisation candidate UUID can create a link to a candidate owned by someone else. Candidate RLS still prevents reading the second candidate row, so this is metadata integrity rather than confirmed data disclosure. Require visibility/ownership of both records or make linking admin-only.

## SECURITY DEFINER inventory

“Authenticated” below means `PUBLIC` was revoked and `EXECUTE` was explicitly granted to the `authenticated` role. “Internal only” means `PUBLIC`/client roles were revoked and no authenticated grant exists. Trigger functions are executable only through their triggers after explicit revocation.

| Latest function definition | Effective executor | Internal authorization check (actual SQL excerpt) | Writes |
|---|---|---|---|
| `current_profile()` — `202607220002` | authenticated; also used by policies/RPCs | `where p.id = auth.uid() and p.is_active` | none |
| `current_organisation_id()` — `202607220002` | authenticated; policy/helper use | `select (public.current_profile()).organisation_id` | none |
| `current_app_role()` — `202607220002` | authenticated; policy/helper use | `select (public.current_profile()).role` | none |
| `assert_admin()` — `202607220003` | internal only | `if actor.id is null or actor.role <> 'admin' then raise exception` | none |
| `write_candidate_audit(...)` — `202607220003` | internal only | gets `current_profile`; no independent permission check | inserts `candidate_audit_log`: organisation_id, candidate_id, actor_id, action, changed_fields, old_record, new_record |
| `update_candidate_operations(uuid,jsonb)` — `202609130001` | authenticated | `if old_row.id is null or old_row.organisation_id <> actor.organisation_id ...`; owner/archive check for non-admin | updates `candidates`: stage, docs_status, next_follow_up, last_contact, actual_joining_date, notes; inserts complete audit snapshot via helper |
| `request_candidate_change(...)` — `202607220003` | authenticated | `actor.role <> 'recruiter' ... candidate.owner_id <> actor.id or candidate.is_archived` | inserts all request fields in `candidate_change_requests` |
| `review_candidate_change(...)` — `202607220003` | authenticated | `actor := public.assert_admin()` plus organisation and pending-status match | candidates: name, phone, email, current_employer, experience_years, target_bank, role, owner_id, fee; request: status, reviewed_by, review_comment, reviewed_at; audit insert |
| `archive_candidate(uuid)` — `202607220003` | authenticated | organisation plus admin-or-owner negative check; no explicit null actor check | candidates: is_archived, archived_at, archived_by; audit insert |
| `restore_candidate(uuid)` — `202607220003` | authenticated | `actor := public.assert_admin()` and organisation-qualified select | candidates: is_archived, archived_at, archived_by; audit insert |
| `permanently_delete_candidate(uuid,text)` — `202608010003` | authenticated | `assert_admin`, exact phrase, organisation, archived, non-demo, non-finalised billing | deletes candidate-owned interviews, candidate audit rows, candidate; inserts organisation-level deletion audit |
| `assign_candidate_owner(uuid,uuid)` — `202607220003` | authenticated | `assert_admin`; target must be active same-org recruiter | candidates.owner_id; audit insert |
| `create_candidate(jsonb)` — `202607310001` | authenticated | `actor := public.assert_admin()`; latest version has no owner-membership check | inserts candidates: organisation_id, core identity/contact/work fields, stage/owner/docs/fee/follow-ups/notes/created_by plus vacancy and profile-extension fields through past_client_association; audit insert |
| `record_email_draft_opened(uuid)` — `202607220003` | authenticated | organisation plus admin-or-owner negative check; no explicit null actor check | audit insert only |
| `record_duplicate_warning_dismissed(uuid,uuid)` — `202607220003` | authenticated | same as email event; linked ID not validated | audit insert only |
| `link_candidate_records(uuid,uuid)` — `202607220003` | authenticated | both candidates same actor organisation; recruiter owns only first | insert/upsert candidate_links: organisation_id, candidate_id, linked_candidate_id, created_by/link_type; audit insert |
| `seed_hiring_spartans_profile(...)` — `202607220004` | database owner only | checks Auth user exists; fixed Hiring Spartans organisation | insert/upsert profiles: id, organisation_id, full_name, email, role |
| `remove_demo_data()` — `202607230001` | authenticated | `actor := public.assert_admin()`; all predicates organisation-scoped | candidates.demo_removed_at/demo_removed_by; audit inserts; demo batch status/removed_by/removed_at |
| `restore_demo_data(uuid)` — `202607230001` | authenticated | `assert_admin`; selected batch belongs to organisation and is removed; rejects an existing active batch | clears candidate removal fields; audit inserts; batch status/restored_by/restored_at |
| `seed_demo_data_for_current_organisation()` — `202607230001` | authenticated | `assert_admin`; advisory lock and organisation-scoped active/removed-batch checks | inserts demo batch, 19 candidate rows, candidate links/change requests/audit rows |
| `get_demo_data_status()` — `202607230001` | authenticated | `actor := public.assert_admin()` and organisation predicates | none |
| `prevent_removed_demo_candidate_mutation()` — `202607230001` | trigger only | permits only admin restoration changes; otherwise raises | none directly; guards candidate update/delete |
| `prevent_removed_demo_reference_mutation()` — `202607230001` | trigger only | rejects normal references to removed demo candidates | none directly; guards request/link/audit insert/update |
| `update_candidate_profile_extensions(uuid,jsonb)` — `202609280001` | authenticated | organisation plus admin-or-owner negative check; vacancy assignment check for recruiters; no explicit null actor check | candidates: vacancy/profile, docs, offer/joining, and document-checklist fields listed below; audit insert |
| `seed_demo_extensions_for_current_organisation()` — `202608010001` | authenticated | `assert_admin`; active organisation batch; no duplicate vacancy batch | inserts demo vacancies/interviews and updates candidate vacancy links |
| `remove_demo_extensions()` — `202608010001` | authenticated | `assert_admin`; organisation and active-batch predicates | vacancies.demo_removed_at, interviews.demo_removed_at |
| `restore_demo_extensions(uuid)` — `202608010001` | authenticated | `assert_admin`; organisation-scoped batch lookup and writes | clears vacancies/interviews.demo_removed_at |
| `seed_demo_candidate_workflow_for_current_organisation()` — `202608010002` | authenticated | `assert_admin`; active organisation batch | inserts/updates demo vacancies; updates workflow/retention candidate fields; updates interviews; inserts candidate_activity |

## Field allowlists, verbatim

`update_candidate_operations`:

```sql
array['stage','docs_status','next_follow_up','last_contact','actual_joining_date','notes']
```

Verdict: consistent with the master-context rule that recruiters may update operational fields, including actual joining date. The function still needs the null-actor fix.

`request_candidate_change`:

```sql
array['name','phone','email','current_employer','experience_years','target_bank','role','owner_id','fee']
```

Verdict: these are proposed changes only, not direct writes to candidates. This matches the documented correction-request model, subject to validating an owner proposal before approval.

`update_candidate_profile_extensions` uses this latest key check:

```sql
where k not in (
  'vacancy_id','relevant_experience','current_ctc','expected_ctc',
  'current_location','preferred_location','grade','notice_period_days',
  'last_working_date','past_client_association','source','docs_status',
  'offer_status','offered_ctc','final_ctc','offer_date','offer_accepted_date',
  'resignation_date','expected_joining_date','actual_joining_date','joining_risk',
  'joining_notes','document_checklist'
)
```

Verdict: none of the five documented admin-only retention fields remain. The allowlist matches “workflow extension fields” in the master context. `docs_status` and `actual_joining_date` overlap the operations RPC, creating two implementations/audit action names for the same mutation. `document_checklist` needs an object-shape check.

## Argument-bypass analysis

| RPC family | Null/missing/empty behavior | Unexpected type/coercion behavior | Security conclusion |
|---|---|---|---|
| operations/profile extension | SQL-null or JSON null updates normally cause no keys to match; `{}` is accepted as no-op | non-object JSON errors in `jsonb_object_keys`; casts reject invalid UUID/date/numeric; document checklist accepts any JSON | malformed values mostly fail closed, but missing actor does not |
| correction request/review | blank reason rejected; field allowlist enforced; proposal shape is not validated until approval casts | owner UUID exists/casts but is not checked for tenant membership; numeric casts/table checks reject invalid values | approval needs target validation |
| archive/restore/delete | unknown UUID normally fails through missing row/FK behavior; exact delete phrase required | `archive_candidate` is null-actor bypassable; restore/delete use `assert_admin` and fail closed | archive is P0, restore/delete are guarded |
| demo functions | null batch intentionally means latest removed batch; active/removed state checked | explicit organisation filters and `assert_admin` | no bypass found statically |

## RLS policy matrix (final migration state)

| Table | SELECT | INSERT | UPDATE | DELETE | Assessment |
|---|---|---|---|---|---|
| organisations | current organisation member | none | none | none | least privilege |
| profiles | all profiles in member's organisation | none | admin, same organisation | none | broad admin column update is consistent with user administration; self-edit intentionally absent |
| candidates | admin sees organisation; recruiter sees owned; removed demos excluded | none | admin, same organisation, removed demos excluded | none | correct for direct access; definer RPC P0 bypasses it |
| candidate_change_requests | admin sees organisation; recruiter sees own requests; removed candidate excluded | none | none | none | writes correctly intended through RPC |
| candidate_audit_log | admin organisation; recruiter only logs for RLS-visible owned candidate | none | none | none | correct read-only client surface |
| candidate_links | same organisation and both candidates not removed; candidate subqueries remain RLS-scoped | none | none | none | client read scope appears correct; linking RPC is broader than visibility of second candidate |
| organisation_settings | organisation members | none | admin, same organisation | none | correct |
| demo_data_batches | admin, same organisation | none | none | none | writes through admin RPC only |
| vacancies | admin organisation; recruiter assigned vacancies; removed demos excluded | admin same organisation | admin same organisation | none | correct; trigger enforces assignee organisation |
| interviews | admin organisation; recruiter interviews for owned candidate; removed demos excluded | admin or owner of active candidate; `created_by=auth.uid()` | admin or owner of active candidate | none | UPDATE is column-broad and can rewrite provenance fields |
| candidate_activity | admin or candidate owner, same organisation, candidate not removed | none | none | none | read-only history surface |
| saved_views | owner; shared views are visible only to admins | self/organisation | self/organisation | self/organisation | note: `is_shared` does not share with recruiters; unclear whether deliberate |
| billing_settings | all organisation members | admin same organisation | admin same organisation | none | recruiter read exposes GST/PAN/payment instructions; likely needed for invoice UI, but product intent should be confirmed |

No table was found with RLS enabled and zero policies. Tables intentionally have no client write policy where writes are RPC-gated. The broadest confirmed policy issue is unrestricted-column interview update, not row-scope bypass.

## Orphan/dead privileged surface

- No business RPC granted to `authenticated` is wholly unused by `src/`.
- `current_profile`, `current_organisation_id`, and `current_app_role` have no direct frontend call sites but are heavily used by RLS policies and other functions. They are policy dependencies, not removable code; only their direct client `EXECUTE` grants appear unnecessary.
- `assert_admin` and `write_candidate_audit` have no frontend calls and are correctly not granted to authenticated clients.
- The two removed-demo guard functions are trigger-only and correctly not granted.

## Limits and verification needed

- This audit derives effective policy/function state from migrations; it did not query `pg_proc`, `information_schema.role_routine_grants`, or `pg_policies` in production. Migration drift cannot be excluded.
- UUID knowledge is required for the P0 exploit. Supabase UUIDs are not guessable in practice, but deactivated users can retain IDs they previously saw; authorization cannot rely on UUID secrecy.
- The master context does not state whether all recruiters should read billing tax identifiers or whether shared saved views should be visible to recruiters. Those two policy choices are flagged for product confirmation, not labelled vulnerabilities.
