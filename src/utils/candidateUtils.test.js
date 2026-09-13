import { describe, expect, it } from "vitest";
import { getInvoiceTotal, groupInvoiceByBank, isInvoiceEligible } from "./candidateUtils";

const joinedCandidate = {
  id: "joined",
  name: "Joined candidate",
  stage: "Joined",
  target_bank: "HDFC",
  fee: 50000,
  is_archived: false,
  actual_joining_date: "2026-01-01",
  retention_status: "In Progress",
};

describe("invoice eligibility", () => {
  it("becomes eligible exactly on day 90", () => {
    expect(isInvoiceEligible(joinedCandidate, "2026-04-01")).toBe(true);
  });

  it("is not eligible on day 89", () => {
    expect(isInvoiceEligible(joinedCandidate, "2026-03-31")).toBe(false);
  });

  it("is not eligible without an actual joining date", () => {
    expect(isInvoiceEligible({ ...joinedCandidate, actual_joining_date: "" }, "2026-04-01")).toBe(false);
  });

  it.each(["Failed", "Replacement Required"])(
    "is not eligible when retention is %s",
    (retention_status) => {
      expect(isInvoiceEligible({ ...joinedCandidate, retention_status }, "2026-04-01")).toBe(false);
    },
  );

  it("keeps already-Invoiced and Paid candidates outside the eligibility queue", () => {
    const invoiced = { ...joinedCandidate, stage: "Invoiced" };
    const paid = { ...joinedCandidate, stage: "Paid" };

    expect(isInvoiceEligible(invoiced, "2026-04-01")).toBe(false);
    expect(isInvoiceEligible(paid, "2026-04-01")).toBe(false);
    expect(invoiced.stage).toBe("Invoiced");
    expect(paid.stage).toBe("Paid");
  });

  it("uses the shared rule for invoice totals and bank groups", () => {
    const eligible = joinedCandidate;
    const day89 = { ...joinedCandidate, id: "day-89", actual_joining_date: "2026-01-02", fee: 70000 };
    const failed = { ...joinedCandidate, id: "failed", retention_status: "Failed", fee: 90000 };
    const candidates = [eligible, day89, failed];

    expect(getInvoiceTotal(candidates, "2026-04-01")).toBe(50000);
    expect(groupInvoiceByBank(candidates, "2026-04-01")).toEqual([
      { bank: "HDFC", candidates: [eligible], subtotal: 50000 },
    ]);
  });
});
