import {
  generateCandidateId,
  normalizeDate,
  normalizeDocs,
  normalizeStage,
} from "./candidateUtils";

const CANDIDATE_EXPORT_COLUMNS = [
  ["Candidate", "name"],
  ["Phone", "phone"],
  ["Email", "email"],
  ["Current Employer", "current_employer"],
  ["Experience", "experience_years"],
  ["Target Bank", "target_bank"],
  ["Role", "role"],
  ["Stage", "stage"],
  ["Recruiter", "recruiter_name"],
  ["Documents", "docs_status"],
  ["Fee ₹", "fee"],
  ["Next Follow-up", "next_follow_up"],
  ["Last Contact", "last_contact"],
  ["Notes", "notes"],
];

const HEADER_ALIASES = {
  candidate: "name",
  name: "name",
  "candidate name": "name",
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  email: "email",
  "current employer": "current_employer",
  employer: "current_employer",
  company: "current_employer",
  exp: "experience_years",
  experience: "experience_years",
  "years experience": "experience_years",
  "experience years": "experience_years",
  "target bank": "target_bank",
  bank: "target_bank",
  client: "target_bank",
  role: "role",
  position: "role",
  stage: "stage",
  recruiter: "recruiter_name",
  owner: "recruiter_name",
  docs: "docs_status",
  documents: "docs_status",
  "document status": "docs_status",
  fee: "fee",
  "fee rs": "fee",
  "fee inr": "fee",
  "fee ₹": "fee",
  "next follow-up": "next_follow_up",
  "next follow up": "next_follow_up",
  nextfollowup: "next_follow_up",
  "last contact": "last_contact",
  lastcontact: "last_contact",
  notes: "notes",
};

const cleanHeader = (header) =>
  String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[().]/g, "")
    .replace(/\s+/g, " ");

const escapeCsvValue = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const parseCsvText = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) {
    rows.push(row);
  }

  return rows;
};

const toCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const body = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  return body ? `${headerLine}\n${body}` : headerLine;
};

const recruiterNameFor = (profiles, ownerId) =>
  profiles.find((profile) => profile.id === ownerId)?.full_name || "";

export const candidatesToCsv = (candidates, profiles = []) =>
  toCsv(
    CANDIDATE_EXPORT_COLUMNS.map(([header]) => header),
    candidates.map((candidate) =>
      CANDIDATE_EXPORT_COLUMNS.map(([, key]) => {
        if (key === "fee") return Number(candidate.fee) || 0;
        if (key === "recruiter_name") return recruiterNameFor(profiles, candidate.owner_id);
        return candidate[key] || "";
      }),
    ),
  );

export const invoiceGroupsToCsv = (groups, profiles = []) => {
  const rows = groups.flatMap((group) => [
    ...group.candidates.map((candidate) => [
      group.bank,
      candidate.name,
      candidate.role,
      recruiterNameFor(profiles, candidate.owner_id),
      Number(candidate.fee) || 0,
      "Candidate",
    ]),
    [group.bank, "Subtotal", "", "", group.subtotal, "Subtotal"],
  ]);

  return toCsv(["Bank", "Candidate", "Role", "Recruiter", "Fee", "Row Type"], rows);
};

export const downloadCsv = (filename, csvText) => {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const parseCandidatesCsv = (text) => {
  const rows = parseCsvText(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => HEADER_ALIASES[cleanHeader(header)] || null);

  return rows.slice(1).map((row) => {
    const imported = {
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
      recruiter_name: "",
      docs_status: "Pending",
      fee: 0,
      next_follow_up: "",
      last_contact: "",
      notes: "",
      is_archived: false,
    };

    headers.forEach((field, index) => {
      if (!field) return;
      imported[field] = String(row[index] || "").trim();
    });

    imported.stage = normalizeStage(imported.stage || "Sourced");
    imported.docs_status = normalizeDocs(imported.docs_status || "Pending");
    imported.fee = Number(String(imported.fee).replace(/[^0-9.-]/g, "")) || 0;
    imported.experience_years =
      imported.experience_years === ""
        ? ""
        : Number(String(imported.experience_years).replace(/[^0-9.-]/g, "")) || "";
    imported.next_follow_up = normalizeDate(imported.next_follow_up);
    imported.last_contact = normalizeDate(imported.last_contact);

    return imported;
  });
};
