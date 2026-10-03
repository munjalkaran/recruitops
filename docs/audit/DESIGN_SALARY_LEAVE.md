# Design: Salary and Leave module

Design date: 2026-09-29. This is a design proposal only. The SQL is illustrative; this document does not create a migration or change application code.

## Product statement and recommended interpretation

Product owner's description, verbatim:

> “admin can track the salary of every recruiter and their leave balance. Recruiters apply for leave from inside the tool. Admin approves from inside the tool. Leave balance decrements automatically. The admin sets the total annual leave allocation once. Each leave is marked paid or unpaid, and unpaid leave affects salary.”

Recommended first release:

- One annual leave policy per organisation and calendar year, with a per-recruiter entitlement snapshot so proration and exceptions remain auditable.
- Recruiters submit dated leave requests; an admin approves/rejects and classifies each approved day or half-day as paid or unpaid.
- Balance is **computed**, not decremented in a mutable counter: entitlement + explicit adjustments - approved paid leave days.
- The module produces a reviewable monthly salary-impact record. It calculates the unpaid-leave deduction from a snapshotted base salary and an agreed divisor, but it is not a statutory payroll engine.
- Recruiters can read only their own leave, entitlement, salary assignment, and published/finalised payroll entries. Admins can read the organisation's records. Whether recruiters should see salary figures is an explicit product decision; the proposed RLS supports own-record visibility, but it can be removed without changing the accounting model.

## What the existing approval pattern does

The repository's correction workflow is a good security and UI reference, but not a reusable data model:

- `candidate_change_requests` stores one candidate field name, old/proposed JSON values, a reason, pending/approved/rejected status, reviewer and timestamps (`supabase/migrations/202607220001_initial_schema.sql:53-74`).
- A partial unique index permits only one pending request per candidate/field (`...initial_schema.sql:76-78`).
- Recruiters cannot insert directly. `request_candidate_change` positively checks recruiter ownership, requires a reason, and uses a literal protected-field allowlist (`supabase/migrations/202607220003_rpc_functions.sql:47-61`).
- `review_candidate_change` locks the request, requires an admin and pending status, applies one allowlisted field, then records reviewer/comment/time (`...rpc_functions.sql:63-90`).
- RLS lets admins see organisation requests and recruiters see only requests they submitted (`supabase/migrations/202607230001_demo_data_support.sql:82-94`). There are no direct client write policies.
- The UI separates the admin queue (`src/components/ApprovalsPage.jsx`) from the recruiter's history (`src/components/MyRequestsPage.jsx`), with realtime refresh.

### Recommendation: a separate leave workflow

Do **not** put leave in `candidate_change_requests`. Reuse the pattern—request row, explicit transitions, row lock, tenant checks, admin queue, requester history, realtime notification—but create leave-specific tables and RPCs.

A leave request is not a proposed scalar field correction. It has a date range, calculated workdays, possible half-days, paid/unpaid allocation, overlap rules, balance effects, cancellation/reversal, salary-period effects, and a durable event history. Forcing these into `field_name`, `old_value`, and `proposed_value` JSON would discard constraints and make payroll joins fragile.

## Proposed data model

All money uses `numeric`, never floating point. Calendar dates use `date`; actions use `timestamptz`. Every tenant-owned row carries `organisation_id` even when derivable, so RLS and indexes remain direct and auditable. Cross-table triggers or RPC checks must ensure referenced profiles/periods belong to the same organisation because ordinary composite foreign keys are otherwise easy to miss.

### Enums

```sql
create type leave_proration_method as enum ('none', 'monthly', 'daily');
create type leave_request_status as enum (
  'pending', 'approved', 'rejected', 'cancellation_pending', 'cancelled', 'reversed'
);
create type leave_pay_type as enum ('paid', 'unpaid');
create type payroll_period_status as enum ('draft', 'finalised', 'paid', 'void');
create type salary_divisor_method as enum ('calendar_days', 'organisation_working_days', 'fixed_30');
```

`reversed` means an administrator invalidated a previously approved request without erasing it. `cancelled` is an accepted cancellation. Neither state consumes balance. Status history is retained separately.

### 1. Annual organisation policy

```sql
create table leave_policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  leave_year smallint not null check (leave_year between 2000 and 2200),
  annual_paid_leave_days numeric(5,2) not null check (annual_paid_leave_days >= 0),
  proration_method leave_proration_method not null default 'monthly',
  allow_negative_paid_balance boolean not null default false,
  max_carry_forward_days numeric(5,2) not null default 0 check (max_carry_forward_days >= 0),
  working_weekdays smallint[] not null default array[1,2,3,4,5,6],
  created_by uuid not null references profiles(id),
  updated_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, leave_year),
  check (cardinality(working_weekdays) between 1 and 7)
);
```

The owner sets `annual_paid_leave_days` once per organisation/year. Updating a policy after requests exist should create a new audited policy revision or require an explicit recalculation preview; it must not silently rewrite historical payroll.

### 2. Organisation holidays

```sql
create table organisation_holidays (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  holiday_date date not null,
  name text not null check (length(btrim(name)) > 0),
  is_paid boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (organisation_id, holiday_date)
);
```

Without a working-week/holiday calendar, “days of leave” cannot be calculated consistently. `is_paid=false` is included for completeness but should be omitted if all organisation holidays are paid.

### 3. Recruiter entitlement snapshot

```sql
create table leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_year smallint not null check (leave_year between 2000 and 2200),
  policy_id uuid not null references leave_policies(id),
  employment_start_date date not null,
  employment_end_date date,
  base_allocated_days numeric(5,2) not null check (base_allocated_days >= 0),
  proration_method leave_proration_method not null,
  proration_fraction numeric(7,6) not null check (proration_fraction between 0 and 1),
  carry_forward_days numeric(5,2) not null default 0 check (carry_forward_days >= 0),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, profile_id, leave_year),
  check (employment_end_date is null or employment_end_date >= employment_start_date)
);
```

This stores the allocation inputs/result, not the remaining balance. It prevents a later policy edit from changing what a person was actually granted. Restrict `profile_id` to active/current or historical recruiter profiles in the same organisation.

### 4. Explicit balance adjustments

```sql
create table leave_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  entitlement_id uuid not null references leave_entitlements(id) on delete cascade,
  days numeric(5,2) not null check (days <> 0),
  reason text not null check (length(btrim(reason)) > 0),
  source text not null check (source in ('admin_adjustment','carry_forward','migration','reversal')),
  effective_date date not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
```

Never overwrite an entitlement to “fix” a balance. Append a signed adjustment with actor and reason.

### 5. Leave request header

```sql
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  start_date date not null,
  end_date date not null,
  reason text not null check (length(btrim(reason)) > 0),
  status leave_request_status not null default 'pending',
  requested_days numeric(5,2) not null check (requested_days > 0),
  approved_paid_days numeric(5,2) not null default 0 check (approved_paid_days >= 0),
  approved_unpaid_days numeric(5,2) not null default 0 check (approved_unpaid_days >= 0),
  review_comment text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references profiles(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (approved_paid_days + approved_unpaid_days <= requested_days)
);

create index leave_requests_person_dates_idx
  on leave_requests (organisation_id, profile_id, start_date, end_date);
create index leave_requests_admin_queue_idx
  on leave_requests (organisation_id, created_at)
  where status in ('pending','cancellation_pending');
```

`requested_days` and approved totals are transactionally derived from the day rows; the client never supplies these summary values.

### 6. Daily allocation rows

```sql
create table leave_request_days (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  leave_request_id uuid not null references leave_requests(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  leave_date date not null,
  duration_days numeric(3,2) not null check (duration_days in (0.5, 1.0)),
  pay_type leave_pay_type,
  created_at timestamptz not null default now(),
  unique (leave_request_id, leave_date)
);

create index leave_request_days_person_date_idx
  on leave_request_days (organisation_id, profile_id, leave_date);
```

A normal uniqueness constraint cannot block only days whose parent request has an active status. Retain all history and enforce overlap inside the only write path: the RPC takes a per-person transaction lock, queries day rows joined to requests in `pending`, `approved`, or `cancellation_pending`, and rejects conflicts. Database tests must exercise concurrency. If two half-day requests on one date are required, add `AM`/`PM` slot rows and enforce overlap by slot.

`pay_type` is null while pending. Approval assigns every day `paid` or `unpaid`; mixed requests are supported and header totals are recalculated.

### 7. Leave event history

```sql
create table leave_request_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  leave_request_id uuid not null references leave_requests(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'submitted','approved','rejected','cancellation_requested','cancelled','reversed'
  )),
  old_status leave_request_status,
  new_status leave_request_status not null,
  comment text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

`details` is audit evidence, not an update API. Only server functions write it.

### 8. Effective-dated salary assignment

```sql
create table salary_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  monthly_base_salary numeric(14,2) not null check (monthly_base_salary >= 0),
  currency char(3) not null default 'INR',
  divisor_method salary_divisor_method not null,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
```

Use an exclusion constraint on `(profile_id, daterange(effective_from, effective_to, '[]'))` so salary assignments cannot overlap. Do not update an old salary when pay changes; close it and add a new effective-dated row.

### 9. Payroll periods and entries

```sql
create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status payroll_period_status not null default 'draft',
  finalised_by uuid references profiles(id) on delete set null,
  finalised_at timestamptz,
  paid_by uuid references profiles(id) on delete set null,
  paid_at timestamptz,
  payment_reference text,
  calculation_version text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, period_start, period_end),
  check (period_end >= period_start)
);

create table payroll_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  payroll_period_id uuid not null references payroll_periods(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  salary_assignment_id uuid not null references salary_assignments(id),
  currency char(3) not null,
  base_salary numeric(14,2) not null check (base_salary >= 0),
  divisor_days numeric(6,2) not null check (divisor_days > 0),
  paid_leave_days numeric(5,2) not null default 0 check (paid_leave_days >= 0),
  unpaid_leave_days numeric(5,2) not null default 0 check (unpaid_leave_days >= 0),
  unpaid_leave_deduction numeric(14,2) not null default 0 check (unpaid_leave_deduction >= 0),
  manual_adjustment numeric(14,2) not null default 0,
  gross_pay numeric(14,2) not null check (gross_pay >= 0),
  payable_salary numeric(14,2) not null check (payable_salary >= 0),
  calculation_inputs jsonb not null,
  admin_note text,
  published_to_recruiter_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, profile_id)
);

create table payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  payroll_entry_id uuid not null references payroll_entries(id) on delete cascade,
  amount numeric(14,2) not null check (amount <> 0),
  reason text not null check (length(btrim(reason)) > 0),
  source text not null check (source in ('admin','leave_reversal','prior_period_correction')),
  related_leave_request_id uuid references leave_requests(id) on delete set null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
```

`calculation_inputs` freezes the exact approved leave IDs/days, policy/divisor, and formula version used. It must be server-generated and immutable after finalisation. `payroll_adjustments` is append-only; `payroll_entries.manual_adjustment` is its cached sum and must be server-maintained, not edited independently.

## RLS design for every table

Enable and force RLS on every new table. All policies require a non-null, active `current_profile()` and matching organisation; do not rely on comparisons with null to deny access. SECURITY DEFINER functions must repeat these checks because they bypass table RLS.

| Table | Recruiter SELECT | Admin SELECT | Direct INSERT/UPDATE/DELETE |
|---|---|---|---|
| `leave_policies` | Current organisation policy only | Organisation policies | Admin insert/update through a constrained RPC or admin RLS; no delete once referenced |
| `organisation_holidays` | Current organisation calendar | Organisation calendar | Admin only; no recruiter writes |
| `leave_entitlements` | `profile_id = actor.id` | Organisation rows | Server/admin RPC only; no delete after use |
| `leave_balance_adjustments` | Own entitlement adjustments | Organisation rows | Admin adjustment RPC only; append-only |
| `leave_requests` | `profile_id = actor.id` | Organisation rows | No direct writes; workflow RPCs only |
| `leave_request_days` | Rows whose `profile_id = actor.id` | Organisation rows | No direct writes; workflow RPCs only |
| `leave_request_events` | Events for own request | Organisation rows | No direct writes; server append-only |
| `salary_assignments` | Own rows only, if self-service salary visibility is approved | Organisation rows | Admin salary RPC only; never recruiter write |
| `payroll_periods` | Only periods having an own published entry; hide organisation-wide payment reference | Organisation rows | Admin payroll RPC only |
| `payroll_entries` | Own row where `published_to_recruiter_at is not null` | Organisation rows | Server/admin RPC only |
| `payroll_adjustments` | Own adjustments only after the parent entry is published | Organisation rows | Admin adjustment RPC only; append-only |

Representative policy shape:

```sql
-- Own leave requests; admins see their organisation.
using (
  organisation_id = public.current_organisation_id()
  and exists (
    select 1 from public.profiles actor
    where actor.id = auth.uid()
      and actor.organisation_id = leave_requests.organisation_id
      and actor.is_active
      and (actor.role = 'admin' or leave_requests.profile_id = actor.id)
  )
)

-- Own published payroll entry; admins see their organisation.
using (
  organisation_id = public.current_organisation_id()
  and exists (
    select 1 from public.profiles actor
    where actor.id = auth.uid()
      and actor.organisation_id = payroll_entries.organisation_id
      and actor.is_active
      and (
        actor.role = 'admin'
        or (payroll_entries.profile_id = actor.id
            and payroll_entries.published_to_recruiter_at is not null)
      )
  )
)
```

Do not grant authenticated users general table writes and assume RLS will protect sensitive columns. Either grant only SELECT and route writes through narrowly scoped functions, or use column grants plus restrictive RLS. Salary, reviewer, pay-type, status, audit, and computed fields must never be client-writable.

## SECURITY DEFINER write paths and exact field allowlists

Every function first resolves `current_profile()`, explicitly rejects null/inactive users, positively checks role and organisation, locks affected rows, validates referenced profile membership, uses a fixed `search_path`, and has EXECUTE revoked from `public` and granted only to `authenticated` where appropriate.

| Function | Actor | Client-controlled allowlist | Server-controlled fields and justification |
|---|---|---|---|
| `submit_leave_request` | Recruiter for self; admin may submit for self only unless HR proxy is approved | `start_date`, `end_date`, optional start/end half-day slot, `reason` | Server assigns `organisation_id`, `profile_id`, `requested_by`, workday rows, `requested_days`, `status='pending'`, timestamps. These establish tenancy, ownership, calculation and workflow integrity. |
| `review_leave_request` | Admin | `request_id`, `decision` (`approved`/`rejected`), per-day `{leave_date, duration_days, pay_type}` limited to the already requested dates/durations, `review_comment` | Server assigns reviewer/time, status, approved totals and event. The day allocation is allowed because the owner explicitly requires paid/unpaid classification; dates/durations cannot expand the recruiter's request. |
| `request_leave_cancellation` | Recruiter, own request | `request_id`, `cancellation_reason` | Server selects immediate cancel versus `cancellation_pending`, actor/time and event based on request/payroll state. Client cannot choose the resulting status. |
| `review_leave_cancellation` | Admin | `request_id`, `decision` (`approved`/`rejected`), `review_comment` | Server restores `approved` on rejection or assigns `cancelled` on approval and appends event. It does not delete days/history. |
| `reverse_approved_leave` | Admin | `request_id`, `reason` | Server assigns `reversed`, actor/time/event. A reason is necessary because this changes balance and potentially payroll. Finalised periods require an adjustment, not a rewrite. |
| `set_leave_policy` | Admin | `leave_year`, `annual_paid_leave_days`, `proration_method`, `allow_negative_paid_balance`, `max_carry_forward_days`, `working_weekdays` | Server assigns organisation/actors/timestamps. Every allowed field is an explicit policy choice; IDs and audit fields are not accepted. |
| `adjust_leave_balance` | Admin | `profile_id`, `leave_year`, signed `days`, `reason`, `effective_date` | Server resolves entitlement/organisation, limits source to `admin_adjustment`, and assigns actor/time. Signed amount and reason are the business operation; provenance is server-owned. |
| `set_salary_assignment` | Admin | `profile_id`, `effective_from`, `effective_to`, `monthly_base_salary`, `currency`, `divisor_method`, `notes` | Server assigns organisation/creator/timestamps and enforces non-overlap. These are precisely the admin's salary decision inputs. |
| `build_payroll_period` | Admin | `period_start`, `period_end` | Server calculates all entry fields from salary/approved leave, writes `calculation_version` and input snapshot. No calculated amount is accepted from the client. |
| `apply_payroll_adjustment` | Admin | `payroll_entry_id`, `amount`, `reason` | Server recalculates payable salary and audit metadata. An amount without a required reason is rejected. Prefer append-only line items over editing `manual_adjustment`. |
| `finalise_payroll_period` | Admin | `payroll_period_id` only | Server recomputes/validates draft, locks it, freezes entries, and records actor/time. The client supplies no salary fields. |
| `publish_payroll_entry` | Admin | `payroll_entry_id` only | Server sets publication time; prevents accidental recruiter visibility of drafts. |
| `record_payroll_payment` | Admin | `payroll_period_id`, `paid_at`, `payment_reference` | Server requires finalised status and assigns paid status/actor. The reference is operational input; totals remain immutable. |

This is intentionally stricter than a generic JSON update RPC. Literal parameter/JSON-key allowlists must have database contract tests so later UI fields cannot become writable accidentally.

## Approval workflow

1. Recruiter selects dates/half-day slots and supplies a reason.
2. Submission RPC builds workday rows from policy and holidays, rejects overlaps under a person/year lock, and returns the calculated requested days. The UI shows the same preview before submission.
3. Admin queue shows current computed balance, request dates, conflicts, payroll-period impact, and suggested split: paid up to available balance, remainder unpaid. The admin must explicitly confirm the paid/unpaid allocation; do not silently consume a negative balance.
4. Approval RPC locks the request and entitlement scope, rechecks balance and overlaps, assigns a pay type to every day, changes status, and appends an event atomically.
5. Rejection records a comment/event and consumes nothing.
6. Recruiter history shows reviewer, decision, paid/unpaid split, cancellation state and balance impact.
7. Realtime may refresh the narrow leave query/queue, but should not trigger the current app-wide refetch pattern.

The current Approvals page can become a tabbed admin inbox (`Candidate Corrections`, `Leave`) and its badge can sum both queues. Leave needs its own table/card layout and review dialog, not the generic old/proposed-value columns. `My Requests` can similarly use tabs while keeping separate services and types.

## Balance calculation: computed is the source of truth

Do not store and decrement `remaining_balance`. A mutable counter drifts when approval is reversed, leave is cancelled, policy changes, carry-forward is added, imports are corrected, or two admins approve concurrently.

For a person/year:

```text
available paid leave
= base_allocated_days
 + carry_forward_days
 + sum(leave_balance_adjustments.days)
 - sum(duration_days for approved leave_request_days where pay_type = 'paid')
```

`cancelled`, `rejected`, and `reversed` requests do not consume balance. Cross-year requests are split by `leave_date` and charged to the matching annual entitlement.

Expose this as a `leave_balance_summary` security-invoker view or a tenant-checked RPC, indexed on `(profile_id, leave_date)` and approved status. At the organisation's likely scale, the aggregate is inexpensive. If measurement later proves otherwise, add a refreshed/cached summary with reconciliation—not a user-editable balance column.

Approval still needs concurrency protection: lock the entitlement row (or take `pg_advisory_xact_lock` on profile/year), recalculate inside the transaction, then approve. Computed correctness alone does not stop two concurrent approvals from both seeing the same remaining balance.

## Edge-case rules

### Approval later withdrawn

Do not change an approved request to `rejected`; that destroys the chronology. Admin uses `reverse_approved_leave` with a reason, producing `reversed` and returning its paid days to computed balance. If the affected payroll period is finalised, append a payroll adjustment in the current/open period rather than rewriting the finalised entry.

### Recruiter cancellation

- Pending request: recruiter may cancel immediately.
- Approved future leave: create `cancellation_pending`; admin approval returns balance and removes salary impact.
- Started/past leave: admin-only reversal/correction with reason.
- Leave included in finalised payroll: preserve the old payroll snapshot and create a compensating adjustment.

### Year rollover

Create the next year's policy and entitlements before requests can be made for that year. Carry-forward is an explicit `carry_forward_days` snapshot/adjustment capped by policy. Never mutate last year's balance. A request spanning 31 December is one request with day rows charged to two entitlements, or—simpler operationally—is split into two requests; choose before implementation.

### Recruiter joining mid-year

Add a trusted employment start date. Calculate and snapshot entitlement using the policy's `none`, `monthly`, or `daily` proration method and a documented rounding rule (recommended: nearest half-day, with admin preview). A later start-date correction creates an explicit entitlement adjustment rather than silently rewriting consumed balance.

### Negative balance

Default: paid balance cannot go below zero. Admin can classify excess days unpaid or append an explicit authorised adjustment. If the policy enables negative balances, show the projected negative amount and require admin confirmation; never let concurrent approvals exceed the intended amount silently.

### Overlapping requests

Reject overlap with any pending, approved, or cancellation-pending workday/slot for that recruiter. Rejected/cancelled/reversed requests do not block a new request. Enforce under a transaction lock; a UI warning alone is insufficient.

### Weekends, holidays, half-days and changed calendars

Materialise request-day rows at submission so a later holiday/calendar edit does not silently change an existing request. An admin may recalculate a still-pending request with an audited action. Confirm whether Saturday is a workday and whether half-days/optional holidays are required before fixing constraints.

### Inactive or departed recruiter

Inactive users cannot submit. Admin retains read access to historical records. Employment end date caps entitlement and future submissions; already finalised payroll remains immutable.

## How unpaid leave feeds salary

“Salary is decided based on paid and unpaid leaves” has three materially different meanings.

### Interpretation A — record only

Admin records base/paid salary and sees approved paid/unpaid leave totals. The tool does not calculate a deduction. This is quickest and lowest-risk, but “affects salary” remains a manual process and the application cannot explain a final amount.

### Interpretation B — salary-impact calculation (recommended first release)

The tool calculates a draft unpaid-leave deduction and payable base salary:

```text
daily rate = monthly base salary / agreed divisor days
unpaid deduction = daily rate * approved unpaid leave days in the period
payable salary = max(0, prorated base salary - unpaid deduction + explicit adjustments)
```

The divisor is a policy choice: actual organisation working days, fixed 30 days, or calendar days. Joining/leaving mid-period, salary changes mid-period, rounding, and approved leave crossing periods must be prorated deterministically. Admin reviews and finalises the snapshot. This fulfils the likely intent without claiming to run payroll.

### Interpretation C — full payroll

A real payroll engine also needs allowances, bonuses, overtime, reimbursements, tax/TDS, PF, ESI, professional tax, deductions, loans/advances, payslips, bank files, compliance calendars, retroactive adjustments and jurisdiction-specific rounding. That is a separate product project. Do not infer it from the sentence above.

Recommendation: build Interpretation B, label it `Salary impact` or `Payroll draft`, and require admin finalisation. Export the finalised record for the actual payroll/accounting process. Never call it net pay unless statutory and other deductions are modelled.

## UI surfaces and navigation

### Recruiter

- Add `My Leave` to recruiter navigation near `My Follow-ups`/`My Requests`.
- Summary cards: available paid leave, pending, approved upcoming, paid used, unpaid used.
- `Apply for leave` dialog with calendar/range, half-day control if approved, workday preview, reason, projected balance, and overlap warning.
- Request history with status, paid/unpaid breakdown, admin comment, cancellation action and event timeline.
- Optional `My Salary`/salary tab showing effective salary and **published** salary-impact entries only. Hide it entirely if the owner intends admin-only salary visibility.

### Admin

- Extend `Approvals` into tabs with separate counts: Candidate Corrections and Leave Requests. The leave review shows current/projected balance, date-day list, paid/unpaid allocation and conflicts.
- Add `Leave & Salary` (or `People`) to admin navigation with tabs:
  - `Balances`: current entitlement/used/available by recruiter, adjustments and drill-down.
  - `Policy & Holidays`: annual allocation, proration/carry-forward rules, workweek and calendar.
  - `Salary`: effective-dated base salary assignments; values masked until intentionally viewed.
  - `Payroll Drafts`: build/review/finalise/publish period entries and export.
- Team profile drill-down can link to the person's leave/salary record but should not load salary values into the general Team list response.

Salary data is more sensitive than candidate data. Avoid fetching all salaries in `App.jsx`'s global startup query or realtime subscription; query only inside authorised admin/recruiter surfaces.

## Prompt-sized implementation sequence

1. **Decision/spec prompt:** answer the questions below; freeze statuses, day counting, proration, visibility and salary formula. No migration.
2. **Leave foundation prompt — Migration 1:** enums; policies, holidays, entitlements, adjustments, requests, days, events; constraints/indexes; `set_updated_at`; RLS/grants; tenant and role SQL tests.
3. **Leave RPC prompt — Migration 2:** submission, review, cancellation/reversal, policy/adjustment functions; exact allowlists; locking; overlap and inactive/null-actor tests.
4. **Balance prompt — Migration 3:** security-safe balance view/RPC, cross-year/proration rules, reconciliation queries and database tests.
5. **Recruiter leave UI prompt:** scoped data service, `My Leave`, submit/preview/history/cancel, empty/error/loading states and unit/component tests.
6. **Admin leave UI prompt:** tabbed approval queue, paid/unpaid day allocation, policy/calendar/balances, badge and realtime scoping, tests.
7. **Salary foundation prompt — Migration 4:** effective salary assignments, payroll periods/entries/adjustments, exclusion/immutability constraints, RLS/grants and security tests.
8. **Salary calculation RPC prompt — Migration 5:** versioned calculation, salary changes/mid-period proration, draft rebuild, finalise/publish/pay transitions and compensating adjustments.
9. **Salary UI prompt:** admin salary/payroll surfaces, recruiter published view if approved, CSV export, masking and tests.
10. **Integration/E2E prompt:** concurrent approvals, cancellation after finalisation, year rollover, mid-year joiner, negative/overlap, inactive users, cross-tenant attempts, demo data and documentation.

Keep leave and salary migrations separate. Leave can ship before salary calculation, and independent rollback/cutover is substantially safer than one large migration.

## Questions that must be answered before building

1. Is the annual allocation one number for every recruiter in an organisation, or can roles/individuals have different entitlements?
2. Is the leave year the calendar year (1 January–31 December), financial year, or each employee's joining-year cycle?
3. How many annual paid-leave days should be the default, and may an admin edit the policy after the year begins?
4. Which days are working days—especially Saturday—and which organisation holidays should not count as leave?
5. Are half-days required? If yes, can a person submit separate AM/PM requests on the same date?
6. Does the recruiter request `paid` versus `unpaid`, does the admin decide it, or should the system automatically use paid balance first and mark the excess unpaid?
7. May approved paid leave take the balance negative? If yes, is there a limit and does it require a special admin confirmation?
8. What proration rule applies to mid-year joiners/leavers: none, completed months, remaining months including start month, or exact calendar/working days? How are fractions rounded?
9. Is unused leave carried forward? What cap/expiry applies? Is encashment needed?
10. Can a recruiter cancel approved leave directly, or must an admin approve cancellation? What is the cutoff once leave has begun?
11. Should one request be allowed to span year-end, salary periods, weekends and holidays?
12. Are there leave categories beyond paid/unpaid—sick, casual, earned, maternity/paternity, comp-off—and does each need its own balance/rules?
13. Does admin approval need delegation, multiple approvers, manager approval, attachments or notifications?
14. Should recruiters be able to see their own base salary and finalised monthly salary-impact record, or is all salary data admin-only?
15. Is “salary” a monthly base/gross figure, annual CTC, take-home amount, or something else? Is INR the only currency?
16. Which unpaid-leave divisor is contractually correct: calendar days, fixed 30, or actual organisation working days?
17. How should salary be prorated for joining/leaving or a salary change during a month, and what rounding rule applies?
18. Does the product only need a calculated unpaid-leave deduction, or a full payroll/payslip system with allowances, statutory deductions and tax?
19. Can admins override the calculated deduction/payable salary? If yes, must every override require a reason and appear as a separate adjustment?
20. When an approved leave is reversed after payroll is finalised, should the difference roll into the next month or reopen the old period?
21. What counts as “paid”: approved leave classification, payroll finalisation, or actual salary payment? Should payment reference/date be tracked?
22. What employment start/end date is authoritative, and who may edit it?
23. How long must leave and salary history be retained after a recruiter is deactivated or leaves the organisation?
24. Do salary fields need encryption beyond database/RLS controls, masked UI, restricted exports, or a separate audit log/access log?
25. Should existing recruiters receive opening entitlements and salary history via import? If so, what is the trusted cutoff date and source file?
