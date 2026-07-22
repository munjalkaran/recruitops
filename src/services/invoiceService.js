import { updateCandidateAsAdmin } from "./candidateService";

export const markCandidatesInvoiced = async (candidates) =>
  Promise.all(
    candidates
      .filter((candidate) => candidate.stage === "Joined" && !candidate.is_archived)
      .map((candidate) => updateCandidateAsAdmin(candidate.id, { stage: "Invoiced" })),
  );

