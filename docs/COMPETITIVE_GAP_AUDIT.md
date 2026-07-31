# Telora competitive gap audit

This is an implementation audit for a small Indian staffing agency using spreadsheets today. It focuses on practical adoption, low operating cost, recruiter permissions, and a clear source of truth. It does not invent competitor claims or replace customer discovery.

## P0 — protect trust and daily operations

- Complete and verify the Supabase migration chain for vacancies, interviews, scorecards, activity, saved views, billing, and reversible demo data.
- Keep Admin/Recruiter RLS boundaries testable with a seeded staging organisation before production rollout.
- Preserve spreadsheet-friendly CSV import/export and make every destructive action reversible or explicitly confirmed.
- Make unavailable-schema states clear and non-misleading, with no raw database error text shown to recruiters.

## P1 — make the product materially better than a shared sheet

- Vacancy demand, linked candidates, interview health, feedback blockers, and days open in one view.
- Interview scorecards and candidate activity timeline so context survives handoffs.
- Saved views backed by Supabase, not browser-only state.
- Fast candidate detail/edit flow with role-aware correction requests and duplicate history.
- Invoice PDF/CSV output driven by configured billing details; never invent tax data.

## P2 — reduce coordination effort

- Rule-based Ask Telora AI answers for follow-ups, notice period, vacancy coverage, interview health, and invoicing.
- Daily interview line-up with copy, print, reschedule, no-show, and feedback actions.
- Deterministic vacancy health indicators and compact filters that work at laptop widths.
- Optional email integrations only after the manual draft/copy workflow is trusted.

## P3 — defer until usage proves the need

- Resume parsing, WhatsApp/SMS, Gmail/Outlook OAuth, payments, client portals, advanced reports, and automated reminders.
- More complex ranking or predictive AI before the underlying candidate and vacancy data is complete.

## Current product position

Telora is strongest when it provides a calm operating layer over the team's existing spreadsheet habits: import cleanly, assign ownership, preserve history, surface next action, and export when needed. The main remaining release blocker is verified Supabase application and role-aware end-to-end testing.
