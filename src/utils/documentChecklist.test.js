import { describe, expect, it } from "vitest";
import { deriveDocumentStatus, getDocumentProgress, normalizeChecklist } from "./documentChecklist";

describe("document checklist", () => {
  it("derives compatible document status and progress", () => {
    const checklist = normalizeChecklist({ id_proof: true, offer_letter: true });
    expect(getDocumentProgress(checklist)).toEqual({ complete: 2, total: 8 });
    expect(deriveDocumentStatus(checklist)).toBe("Partial");
    expect(deriveDocumentStatus({ id_proof: true, address_proof: true, education_documents: true, experience_letters: true, salary_slips: true, offer_letter: true, resignation_proof: true, appointment_acceptance: true })).toBe("Complete");
  });
});
