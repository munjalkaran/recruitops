import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607230001_demo_data_support.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("demo data migration security contract", () => {
  it("requires Admin for seed, remove, restore, and status RPCs", () => {
    expect(migration.match(/actor := public\.assert_admin\(\);/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("soft-removes only demo candidates in the actor organisation", () => {
    expect(migration).toContain("c.organisation_id = actor.organisation_id");
    expect(migration).toContain("and c.is_demo");
    expect(migration).toContain("set demo_removed_at = removed_timestamp");
  });

  it("keeps seed idempotent and restore batch-scoped", () => {
    expect(migration).toContain("active sample data already exists; no duplicates were created");
    expect(migration).toContain("demo_batch_id = target_batch.id");
    expect(migration).toContain("demo_data_batches_one_active_per_org_idx");
  });

  it("prevents permanent deletion of sample candidates", () => {
    expect(migration).toContain("if old_row.is_demo then");
    expect(migration).toContain("sample candidates cannot be permanently deleted");
  });
});
