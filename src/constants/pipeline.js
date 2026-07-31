export const PIPELINE_STAGES = [
  "Sourced",
  "Contacted",
  "Screened",
  "Interviewing",
  "Selected",
  "Documentation",
  "Joined",
  "Invoiced",
  "Paid",
  "Dropped",
];

export const CLOSED_STAGES = ["Joined", "Invoiced", "Paid", "Dropped"];

export const ROLES = {
  ADMIN: "admin",
  RECRUITER: "recruiter",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.RECRUITER]: "Recruiter",
};

export const DEMO_ORGANISATION_ID = "11111111-1111-4111-8111-111111111111";

export const DEMO_PROFILE_IDS = {
  admin: "22222222-2222-4222-8222-222222222222",
  priya: "33333333-3333-4333-8333-333333333333",
  arjun: "44444444-4444-4444-8444-444444444444",
  sana: "55555555-5555-4555-8555-555555555555",
};

export const DEMO_ORGANISATION = {
  id: DEMO_ORGANISATION_ID,
  name: "Hiring Spartans",
  slug: "hiring-spartans",
  plan_code: "free",
  active_user_limit: 15,
  is_active: true,
};

export const DEMO_PROFILES = [
  {
    id: DEMO_PROFILE_IDS.admin,
    organisation_id: DEMO_ORGANISATION_ID,
    full_name: "Admin Owner",
    email: "admin.owner@example.com",
    role: ROLES.ADMIN,
    avatar_url: "",
    is_active: true,
  },
  {
    id: DEMO_PROFILE_IDS.priya,
    organisation_id: DEMO_ORGANISATION_ID,
    full_name: "Priya Nair",
    email: "priya.nair@example.com",
    role: ROLES.RECRUITER,
    avatar_url: "",
    is_active: true,
  },
  {
    id: DEMO_PROFILE_IDS.arjun,
    organisation_id: DEMO_ORGANISATION_ID,
    full_name: "Arjun Mehta",
    email: "arjun.mehta@example.com",
    role: ROLES.RECRUITER,
    avatar_url: "",
    is_active: true,
  },
  {
    id: DEMO_PROFILE_IDS.sana,
    organisation_id: DEMO_ORGANISATION_ID,
    full_name: "Sana Kapoor",
    email: "sana.kapoor@example.com",
    role: ROLES.RECRUITER,
    avatar_url: "",
    is_active: true,
  },
];

export const DEMO_ORGANISATION_SETTINGS = {
  organisation_id: DEMO_ORGANISATION_ID,
  display_name: "Hiring Spartans",
  email_signature: "Hiring Spartans Recruitment Team",
  default_email_template: "",
};

export const DOC_STATUSES = ["Pending", "Partial", "Complete"];

export const OPERATIONAL_FIELDS = [
  "stage",
  "docs_status",
  "next_follow_up",
  "last_contact",
  "notes",
  "vacancy_id",
  "relevant_experience",
  "current_ctc",
  "expected_ctc",
  "current_location",
  "preferred_location",
  "grade",
  "notice_period_days",
  "last_working_date",
  "past_client_association",
  "offer_status",
  "offered_ctc",
  "final_ctc",
  "offer_date",
  "offer_accepted_date",
  "resignation_date",
  "expected_joining_date",
  "actual_joining_date",
  "joining_risk",
  "joining_notes",
  "document_checklist",
  "retention_period_days",
  "retention_start_date",
  "retention_due_date",
  "retention_status",
  "replacement_guarantee_end_date",
  "invoice_eligibility_date",
];

export const PROTECTED_FIELDS = [
  "name",
  "phone",
  "email",
  "current_employer",
  "experience_years",
  "target_bank",
  "role",
  "owner_id",
  "fee",
];

export const CANDIDATE_FIELD_LABELS = {
  name: "Candidate",
  phone: "Phone",
  email: "Email",
  current_employer: "Current employer",
  experience_years: "Experience",
  target_bank: "Target bank",
  role: "Role",
  stage: "Stage",
  owner_id: "Recruiter",
  docs_status: "Documents",
  fee: "Fee",
  next_follow_up: "Next follow-up",
  last_contact: "Last contact",
  notes: "Notes",
};

export const STAGE_DEFINITIONS = {
  Sourced:
    "Candidate/resume has been added to the pipeline but meaningful contact has not happened.",
  Contacted: "The recruiter has called, messaged, or attempted first contact.",
  Screened: "Eligibility, interest, experience, location and role fit have been checked.",
  Interviewing:
    "An interview is scheduled or interview rounds are in progress.",
  Selected: "The client selected the candidate, pending paperwork and joining.",
  Documentation: "Candidate documents are being collected, checked or submitted.",
  Joined: "The candidate joined and the placement is now invoiceable.",
  Invoiced: "The invoice has been raised.",
  Paid: "Payment has been received.",
  Dropped: "The candidate is rejected, not interested or no longer active.",
};

export const STAGE_STYLES = {
  Sourced: {
    background: "#eef4ff",
    color: "#2563eb",
    border: "#dbeafe",
  },
  Contacted: {
    background: "#e8fbfd",
    color: "#0891b2",
    border: "#cffafe",
  },
  Screened: {
    background: "#e9fbf6",
    color: "#0f766e",
    border: "#ccfbf1",
  },
  Interviewing: {
    background: "#eef0ff",
    color: "#4f46e5",
    border: "#e0e7ff",
  },
  Selected: {
    background: "#f4efff",
    color: "#7c3aed",
    border: "#ede9fe",
  },
  Documentation: {
    background: "#fff7e8",
    color: "#c46a18",
    border: "#ffedd5",
  },
  Joined: {
    background: "#eaf9ef",
    color: "#2f9b55",
    border: "#dcfce7",
  },
  Invoiced: {
    background: "#e8f8f0",
    color: "#2f855a",
    border: "#d1fae5",
  },
  Paid: {
    background: "#f0f9dc",
    color: "#4d7c0f",
    border: "#ecfccb",
  },
  Dropped: {
    background: "#f3f6fa",
    color: "#64748b",
    border: "#e2e8f0",
  },
};

export const DOC_STYLES = {
  Pending: {
    background: "#edf2f7",
    color: "#718096",
    border: "#e2e8f0",
  },
  Partial: {
    background: "#fff5e7",
    color: "#c46a18",
    border: "#fed7aa",
  },
  Complete: {
    background: "#ebfaef",
    color: "#349a50",
    border: "#bbf7d0",
  },
};
