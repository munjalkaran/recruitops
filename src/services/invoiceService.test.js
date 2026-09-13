import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCandidateAsAdmin } from "./candidateService";
import { markCandidatesInvoiced } from "./invoiceService";

vi.mock("./candidateService", () => ({
  updateCandidateAsAdmin: vi.fn().mockResolvedValue({ stage: "Invoiced" }),
}));

describe("markCandidatesInvoiced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates only currently eligible candidates and leaves final stages untouched", async () => {
    const eligible = {
      id: "eligible",
      stage: "Joined",
      is_archived: false,
      actual_joining_date: "2026-01-01",
      retention_status: "Completed",
    };
    const invoiced = { ...eligible, id: "invoiced", stage: "Invoiced" };
    const paid = { ...eligible, id: "paid", stage: "Paid" };

    await markCandidatesInvoiced([eligible, invoiced, paid], "2026-04-01");

    expect(updateCandidateAsAdmin).toHaveBeenCalledTimes(1);
    expect(updateCandidateAsAdmin).toHaveBeenCalledWith("eligible", { stage: "Invoiced" });
    expect(invoiced.stage).toBe("Invoiced");
    expect(paid.stage).toBe("Paid");
  });
});
