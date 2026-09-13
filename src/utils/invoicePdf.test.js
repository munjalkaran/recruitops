import { describe, expect, it } from "vitest";
import { buildInvoicePdf } from "./invoicePdf";
import { getInvoiceTotal, groupInvoiceByBank } from "./candidateUtils";

describe("invoice safeguards", () => {
  it("keeps invoicing limited to candidates eligible on day 90", () => {
    const candidates = [
      { name: "Joined", stage: "Joined", target_bank: "HDFC", fee: 50000, is_archived: false, actual_joining_date: "2026-01-01", retention_status: "Completed" },
      { name: "Selected", stage: "Selected", target_bank: "HDFC", fee: 90000, is_archived: false },
      { name: "Archived joined", stage: "Joined", target_bank: "HDFC", fee: 70000, is_archived: true, actual_joining_date: "2026-01-01", retention_status: "Completed" },
    ];

    expect(getInvoiceTotal(candidates, "2026-04-01")).toBe(50000);
    expect(groupInvoiceByBank(candidates, "2026-04-01")).toEqual([
      { bank: "HDFC", candidates: [candidates[0]], subtotal: 50000 },
    ]);
  });

  it("builds selectable text with configured issuer and invoice details", async () => {
    const blob = buildInvoicePdf({
      organisationName: "Hiring Spartans",
      invoiceNumber: "TELORA-20260801-001",
      generatedAt: new Date("2026-08-01T00:00:00.000Z"),
      groups: [{ bank: "HDFC Bank", subtotal: 50000, candidates: [{ name: "Asha Rao", fee: 50000 }] }],
      billingSettings: { payment_terms: "30 days" },
    });
    const text = await blob.text();

    expect(text).toContain("Hiring Spartans");
    expect(text).toContain("TELORA-20260801-001");
    expect(text).toContain("INR 50,000");
    expect(text).not.toContain("GSTIN:");
  });
});
