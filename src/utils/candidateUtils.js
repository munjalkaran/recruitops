import { CLOSED_STAGES, DOC_STATUSES, PIPELINE_STAGES } from "../constants/pipeline";

const pad = (value) => String(value).padStart(2, "0");

export const todayIso = () => {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

export const generateCandidateId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `candidate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const createBlankCandidate = ({ organisationId, createdBy } = {}) => ({
  id: generateCandidateId(),
  name: "",
  phone: "",
  email: "",
  current_employer: "",
  experience_years: "",
  target_bank: "",
  role: "",
  stage: "Sourced",
  owner_id: null,
  docs_status: "Pending",
  fee: 0,
  next_follow_up: "",
  last_contact: "",
  notes: "",
  is_archived: false,
  archived_at: null,
  archived_by: null,
  created_by: createdBy || null,
  organisation_id: organisationId || null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const isCandidateStale = (candidate, today = todayIso()) =>
  Boolean(candidate.next_follow_up) &&
  candidate.next_follow_up < today &&
  !CLOSED_STAGES.includes(candidate.stage);

export const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getStageCounts = (candidates) =>
  PIPELINE_STAGES.reduce((counts, stage) => {
    counts[stage] = candidates.filter((candidate) => candidate.stage === stage).length;
    return counts;
  }, {});

export const getInvoiceTotal = (candidates) =>
  candidates
    .filter((candidate) => candidate.stage === "Joined" && !candidate.is_archived)
    .reduce((total, candidate) => total + (Number(candidate.fee) || 0), 0);

export const groupInvoiceByBank = (candidates) => {
  const joined = candidates.filter(
    (candidate) => candidate.stage === "Joined" && !candidate.is_archived,
  );
  const groups = joined.reduce((bankGroups, candidate) => {
    const bankName = candidate.target_bank || "Unassigned bank";
    if (!bankGroups[bankName]) {
      bankGroups[bankName] = {
        bank: bankName,
        candidates: [],
        subtotal: 0,
      };
    }

    bankGroups[bankName].candidates.push(candidate);
    bankGroups[bankName].subtotal += Number(candidate.fee) || 0;
    return bankGroups;
  }, {});

  return Object.values(groups).sort((a, b) => a.bank.localeCompare(b.bank));
};

export const getUniqueBanks = (candidates) =>
  [...new Set(candidates.map((candidate) => candidate.target_bank).filter(Boolean))].sort();

export const normalizeStage = (value) => {
  const match = PIPELINE_STAGES.find(
    (stage) => stage.toLowerCase() === String(value || "").trim().toLowerCase(),
  );
  return match || "Sourced";
};

export const normalizeDocs = (value) => {
  const match = DOC_STATUSES.find(
    (status) => status.toLowerCase() === String(value || "").trim().toLowerCase(),
  );
  return match || "Pending";
};

export const normalizeDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return "";
};

export const getProfileById = (profiles, id) =>
  profiles.find((profile) => profile.id === id) || null;

export const getRecruiterName = (profiles, ownerId) =>
  getProfileById(profiles, ownerId)?.full_name || "Unassigned";

export const formatExperience = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "";
  return `${amount} ${amount === 1 ? "year" : "years"}`;
};

export const getCandidateActivityDate = (candidate) =>
  candidate.updated_at || candidate.last_contact || candidate.created_at || candidate.next_follow_up || "";
