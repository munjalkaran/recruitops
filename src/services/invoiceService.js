import { updateCandidateAsAdmin } from "./candidateService";
import { isInvoiceEligible, todayIso } from "../utils/candidateUtils";

export const markCandidatesInvoiced = async (candidates, today = todayIso()) =>
  Promise.all(
    candidates
      .filter((candidate) => isInvoiceEligible(candidate, today))
      .map((candidate) => updateCandidateAsAdmin(candidate.id, { stage: "Invoiced" })),
  );
