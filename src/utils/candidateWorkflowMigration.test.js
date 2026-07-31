import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/202608010002_candidate_workflow_and_retention.sql", import.meta.url), "utf8").toLowerCase();

describe("candidate workflow migration contract", () => {
  it("adds offer, joining, checklist and retention foundations", () => {
    ["offer_status", "expected_joining_date", "actual_joining_date", "document_checklist", "retention_period_days", "retention_due_date", "invoice_eligibility_date"].forEach((field) => expect(migration).toContain(field));
  });

  it("keeps current Joined invoice logic unchanged", () => {
    expect(migration).toContain("retention fields are informational only");
    expect(migration).toContain("seed_demo_candidate_workflow_for_current_organisation");
    expect(migration).not.toContain("update candidates set stage = 'invoiced'");
  });
});
