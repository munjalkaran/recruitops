# Recruitment Pipeline Tool — Project Brief

A complete handoff document. Paste this into a ChatGPT Project and build with Codex.
It contains the business context, what has already been prototyped, the full feature
spec, the target architecture for the real (multi-user) build, a phased roadmap, and
build instructions.

---

## 1. What this is

A lightweight, Excel-feeling web app for a small **recruitment / staffing agency**
that places candidates into banks and NBFCs in India. It replaces the scattered Excel
sheets the team uses today with one shared pipeline that nothing slips out of, and it
automates the two jobs that eat the owner's time: chasing follow-ups and raising
month-end invoices.

**Design principle:** it must feel like a smarter spreadsheet, not a new CRM. The
users are non-technical. Familiarity and low friction beat features.

---

## 2. The business and the problem

**How the agency works today:**
1. Source candidate resumes (scraped/downloaded from Naukri, LinkedIn, job sites).
2. Team calls candidates (human calling).
3. Interview rounds with the bank.
4. Documentation collected from the candidate.
5. Candidate joins the bank.
6. At month-end, an invoice is raised to the bank / end client.
7. Agency gets paid.

**The owner's real pain:** he is so buried in *running* this pipeline (data entry,
calling, follow-ups, document chasing, invoicing) that he has no time to develop new
bank tie-ups (e.g. his target client "STFC").

**Core thesis driving the build:** he asked for a tool to *find new banks*, but a
business-development bot does not create time — it adds work. Landing a new bank is a
human trust sale no agent can close for him. So the tool's job is to **automate the
delivery grind and hand his hours back**, and *then* assist business development. Build
delivery automation first; BD assistant later.

---

## 3. What has already been built (working prototype)

A **single-file HTML prototype** (no build step, opens by double-click, data saved in
the browser via `localStorage`). It proves the concept and the look-and-feel. It is
single-user and local-only — that is the main limit the real build must fix.

Prototype features that are DONE and should carry over exactly:
- Editable spreadsheet-style grid (click a cell to edit inline).
- Pipeline stages as coloured dropdown pills.
- Dashboard chips per stage with live counts, doubling as one-click filters.
- **Stale detection:** any candidate whose "Next Follow-up" date is past today (and not
  in a closed stage) turns amber, with a "Going stale" counter chip.
- **"To invoice" chip:** live sum of fees for all candidates in the "Joined" stage.
- **Month-end invoice generator:** groups "Joined" candidates by bank, subtotals fees,
  shows a grand total, downloads an invoice CSV, and marks them "Invoiced" in one click.
- Search, recruiter filter, clear-filters.
- CSV import (pull in existing sheets) and CSV export (open in real Excel anytime).
- A demo "Ask the sheet" command bar (offline keyword matching in the prototype;
  becomes a real AI agent in the full build — see Section 6).

---

## 4. Data model

One record per candidate. Fields:

| Field         | Type                 | Notes                                            |
|---------------|----------------------|--------------------------------------------------|
| id            | string               | unique                                           |
| name          | text                 | candidate name                                   |
| phone         | text                 |                                                  |
| employer      | text                 | current employer                                 |
| exp           | number               | years of experience                              |
| bank          | text                 | target bank / end client                         |
| role          | text                 | role being placed for                            |
| stage         | enum                 | see pipeline stages below                        |
| owner         | text                 | recruiter handling this candidate                |
| docs          | enum                 | Pending / Partial / Complete                     |
| fee           | number               | placement fee (₹) billed on join                 |
| nextFollowUp  | date (YYYY-MM-DD)    | drives stale detection                           |
| lastContact   | date (YYYY-MM-DD)    |                                                  |
| notes         | text                 | free notes                                       |

**Pipeline stages (in order):**
`Sourced → Contacted → Screened → Interviewing → Selected → Documentation → Joined →
Invoiced → Paid`, plus `Dropped` (a lost state).

**Closed stages** (excluded from stale detection): `Joined, Invoiced, Paid, Dropped`.

**Stale rule:** `nextFollowUp` is set AND `nextFollowUp < today` AND stage not closed.

---

## 5. Target architecture (the real, multi-user build)

The prototype is local-only. The real product must let ~10 recruiters see and edit the
same pipeline live. Recommended stack (builds cleanly in Codex):

- **Frontend:** React + Vite + Tailwind CSS. Reuse the prototype's layout and styling.
- **Backend + database:** **Supabase** (hosted Postgres + auth + realtime). Chosen
  because it gives shared multi-user data, simple email/password auth, and live sync
  (all recruiters see updates instantly) with minimal backend code.
- **Hosting:** Vercel for the frontend; Supabase hosts the DB/auth.
- **AI layer:** OpenAI API (or Anthropic — either works) for two things: resume parsing
  and the natural-language "Ask the sheet" command bar. Keep the API key server-side
  (a Supabase Edge Function or a small serverless route) — never in the frontend.

**Tables (minimum):**
- `candidates` — the data model in Section 4, plus `created_at`, `updated_at`.
- `users` / recruiters — handled by Supabase Auth.
- (Later) `banks` and `bd_leads` for the BD assistant.

**Auth:** simple. Owner is admin (sees everything, runs invoicing). Recruiters see the
shared pipeline and edit their own + others' candidates. Keep roles minimal.

---

## 6. The AI features (what makes it feel magic)

**a) "Ask the sheet" command bar (natural-language control).**
User types plain English; the app filters or edits the grid. Send the user's message +
the current schema + a compact snapshot of the data to the LLM, and require a JSON
response describing the action (filter / add / update / delete / answer). Parse it,
apply it to the grid. Actions to support:
- filter (by stage, bank, recruiter, stale, free-text search)
- add candidate
- update a candidate (e.g. "move Suresh to Selected")
- answer a question about the data ("how many candidates is Anjali handling?")

**b) Resume auto-parse (Phase 1.5 — biggest time-saver).**
User drops a resume PDF. Extract text (pdf-parse / pdf.js) → send to the LLM → get back
structured JSON (name, phone, employer, experience, location, current role) → create a
candidate row pre-filled. This removes the daily manual data entry that eats the team's
hours. Handle messy resumes gracefully (leave fields blank rather than guessing wrong).

---

## 7. Phased roadmap

**Phase 1 — Delivery engine (build first; this buys back time)**
- Multi-user shared pipeline (Supabase) with live sync.
- Everything in the prototype: grid, stages, stale detection, filters, CSV in/out.
- Month-end invoice generation grouped by bank.
- Real "Ask the sheet" AI command bar.

**Phase 1.5 — Kill the data entry**
- Resume PDF drop → AI parse → pre-filled candidate row.
- First-touch outreach: bulk WhatsApp/SMS "are you looking for a bank role?" to qualify
  interest before humans spend calling time. (Use a compliant provider; see Section 8.
  Do NOT attempt AI voice calling — not worth it in India yet.)

**Phase 2 — Business-development assistant (spends the freed time)**
- Build a target list of banks/NBFCs.
- Find the right HR / talent-acquisition contacts.
- Draft outreach sequences.
- A separate BD pipeline board (reuse the same grid pattern).
This *assists* the owner's human BD; it does not replace the relationship selling.

---

## 8. Automation hooks (design these in from the start)

The whole point is that a task done manually once should never be manual again:
- **Lead/candidate capture in, not typed in:** website careers form and job-board
  exports drop straight into `candidates`. No manual entry.
- **Stale auto-nudge:** a scheduled job (Supabase cron / a serverless cron) runs nightly,
  finds stale candidates, and sends the owning recruiter a WhatsApp/email reminder, then
  escalates to the owner if ignored. This is the automated version of the amber flag.
- **Month-end auto-invoice:** on the 1st, auto-generate invoices for everyone in
  "Joined", grouped by bank, and email the owner for a one-click confirm.
- **Weekly summary:** every Monday, email the owner "X sourced, Y interviewing, Z joined,
  ₹N invoiced this week" so he never has to ask where things stand.

---

## 9. Constraints and honest flags

- **Scraping is the fragile foundation.** Naukri and LinkedIn actively block scraping;
  a banned account kills the sourcing engine overnight. The steady version is proper
  recruiter licences (legit search + export) plus the agency's own inbound form. Build
  the tool so sourcing is not hard-wired to a scraper.
- **Personal data:** storing candidates' personal data falls under India's DPDP Act.
  Keep access controlled, don't over-retain, and be ready to delete on request. This is
  the client's/owner's responsibility but the tool should not make it worse.
- **AI cost:** the resume-parse and command-bar features call an LLM API, which has a
  small running cost. At this volume it is minor (order of a few dollars/month), but it
  is not zero — the owner should know.
- **WhatsApp/SMS outreach:** use a compliant business messaging provider and respect
  India's TRAI telemarketing/DND rules. Keep first-touch opt-out-friendly.

---

## 10. Build instructions for Codex

Suggested sequence:
1. Scaffold a React + Vite + Tailwind app. Recreate the prototype UI (Section 3) exactly
   — header, chips, toolbar, editable grid, invoice modal, command bar — but with clean
   components.
2. Wire up Supabase: create the `candidates` table (Section 4), add auth (email/password),
   and replace `localStorage` with Supabase reads/writes. Turn on realtime so all users
   see live updates.
3. Port the invoice generator to read from the DB (group "Joined" by bank, subtotal fees,
   download CSV, bulk-update to "Invoiced").
4. Add the real "Ask the sheet" agent: a server-side route/Edge Function that holds the
   API key, takes the user message + schema + data snapshot, returns a JSON action, which
   the frontend applies.
5. Add resume-parse (Phase 1.5): PDF upload → text extract → LLM → pre-filled row.
6. Add the scheduled automation jobs (Section 8): stale nudge, month-end invoice, weekly
   summary.
7. Deploy: frontend to Vercel, DB/auth on Supabase. Add the API key as a server-side
   environment variable only.

**Keep it simple.** The users are non-technical. Fast load, no clutter, spreadsheet feel.
Every screen should be usable without training.

---

## Appendix — Design prompt (use in your UI design tool first)

Design a clean, minimal web app UI for a recruitment pipeline tracker used by a small
staffing agency that places candidates into banks. Feeling: "a spreadsheet, but smarter"
— familiar and calm, not a flashy dashboard. Users are non-technical.

Style: light and airy, lots of white space; neutral slate-grey text/borders; one calm
accent (muted teal #0d9488); soft pastel tints for pipeline stages (never loud); rounded
corners 8–12px, thin borders, small data-dense text, subtle hover states; no heavy
gradients/shadows; system sans-serif.

Components: (1) Header with title + action buttons (Add candidate, Month-end invoice,
Import CSV, Export to Excel). (2) Dashboard chip row — one pill per stage with a count,
each a filter; plus amber "Going stale" and green "To invoice: ₹X" pills. (3) Toolbar —
search, recruiter dropdown, clear-filters, "X of Y shown". (4) The hero: an editable
spreadsheet-style grid, sticky header, horizontal scroll; columns Candidate, Phone,
Current Employer, Exp, Target Bank, Role, Stage (coloured pill), Recruiter, Docs, Fee ₹,
Next Follow-up, Last Contact, Notes; click a cell to edit; overdue rows tinted soft amber
with ⚠. (5) Month-end invoice modal — Joined candidates grouped by bank, subtotals, grand
total, download + mark-invoiced. (6) "Ask the sheet" bar pinned bottom — plain-English
input with a small message log. Make it feel trustworthy and quiet.
