import { getCandidateActivityDate, getRecruiterName } from "./candidateUtils";

export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");

const levenshtein = (left, right) => {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = [];

  for (let i = 0; i < left.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      current[j + 1] = Math.min(
        previous[j + 1] + 1,
        current[j] + 1,
        previous[j] + (left[i] === right[j] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const namesAreSimilar = (left, right) => {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  return levenshtein(a, b) <= 2;
};

export const classifyDuplicateMatch = (candidate, existing) => {
  if (!candidate || !existing || candidate.id === existing.id) return null;

  const phone = normalizePhone(candidate.phone);
  const existingPhone = normalizePhone(existing.phone);
  if (phone && existingPhone && phone === existingPhone) {
    return { strength: "strong", matchType: "Phone match" };
  }

  const email = normalizeEmail(candidate.email);
  const existingEmail = normalizeEmail(existing.email);
  if (email && existingEmail && email === existingEmail) {
    return { strength: "strong", matchType: "Email match" };
  }

  const sameName = normalizeName(candidate.name) === normalizeName(existing.name);
  const sameEmployer =
    normalizeName(candidate.current_employer) &&
    normalizeName(candidate.current_employer) === normalizeName(existing.current_employer);

  if (sameName && sameEmployer) {
    return { strength: "soft", matchType: "Same name and employer" };
  }

  if (namesAreSimilar(candidate.name, existing.name)) {
    return { strength: "soft", matchType: "Similar name" };
  }

  return null;
};

export const findDuplicateWarnings = (candidate, candidates, profiles = []) =>
  candidates
    .map((existing) => {
      const classification = classifyDuplicateMatch(candidate, existing);
      if (!classification) return null;
      return {
        candidate: existing,
        strength: classification.strength,
        matchType: classification.matchType,
        previousBank: existing.target_bank || "-",
        previousRole: existing.role || "-",
        previousStage: existing.stage || "-",
        previousRecruiter: getRecruiterName(profiles, existing.owner_id),
        previousActivityDate: getCandidateActivityDate(existing),
        isArchived: Boolean(existing.is_archived),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.strength === b.strength ? 0 : a.strength === "strong" ? -1 : 1));
