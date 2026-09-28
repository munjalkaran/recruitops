import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/202608010002_candidate_workflow_and_retention.sql", import.meta.url), "utf8").toLowerCase();
const operationsMigration = readFileSync(new URL("../../supabase/migrations/202609130001_add_actual_joining_date_to_operations.sql", import.meta.url), "utf8").toLowerCase();
const adminOnlyMigration = readFileSync(new URL("../../supabase/migrations/202609280001_restrict_retention_invoice_fields_to_admin.sql", import.meta.url), "utf8").toLowerCase();

describe("candidate workflow migration contract", () => {
  it("adds offer, joining, checklist and retention foundations", () => {
    ["offer_status", "expected_joining_date", "actual_joining_date", "document_checklist", "retention_period_days", "retention_due_date", "invoice_eligibility_date"].forEach((field) => expect(migration).toContain(field));
  });

  it("keeps current Joined invoice logic unchanged", () => {
    expect(migration).toContain("retention fields are informational only");
    expect(migration).toContain("seed_demo_candidate_workflow_for_current_organisation");
    expect(migration).not.toContain("update candidates set stage = 'invoiced'");
  });

  it("allows actual joining date through the operational update RPC", () => {
    expect(operationsMigration).toContain("update_candidate_operations");
    expect(operationsMigration).toContain("'actual_joining_date'");
    expect(operationsMigration).toContain("old_row.owner_id <> actor.id or old_row.is_archived");
  });

  it("removes admin-managed retention fields from the profile extension RPC", () => {
    const allowlist = adminOnlyMigration.match(/where k not in \((.*?)\) limit 1;/s)?.[1] || "";
    const adminOnlyFields = [
      "retention_period_days",
      "retention_start_date",
      "retention_due_date",
      "retention_status",
      "replacement_guarantee_end_date",
      "invoice_eligibility_date",
    ];

    adminOnlyFields.forEach((field) => {
      expect(allowlist).not.toContain(`'${field}'`);
      expect(adminOnlyMigration).not.toContain(`${field} = case`);
    });
    expect(allowlist).toContain("'actual_joining_date'");
    expect(adminOnlyMigration).toContain("candidate.organisation_id <> actor.organisation_id");
    expect(adminOnlyMigration).toContain("actor.role <> 'admin' and candidate.owner_id <> actor.id");
    expect(adminOnlyMigration).toContain("assigned_recruiter_id = actor.id");
    expect(adminOnlyMigration).toContain("write_candidate_audit");
    expect(adminOnlyMigration).toContain("grant execute on function public.update_candidate_profile_extensions(uuid, jsonb) to authenticated");
  });
});
