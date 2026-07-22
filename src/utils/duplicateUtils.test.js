import { describe, expect, it } from "vitest";
import { findDuplicateWarnings } from "./duplicateUtils";

describe("duplicate warning history", () => {
  it("includes a strong match against an archived sample candidate", () => {
    const current = {
      id: "new-rohit",
      name: "Rohit Sharma",
      phone: "9000000001",
      target_bank: "HDFC Bank",
      role: "Relationship Manager",
      owner_id: "priya",
      is_archived: false,
    };
    const previous = {
      id: "old-rohit",
      name: "Rohit Sharma",
      phone: "9000000001",
      target_bank: "Axis Bank",
      role: "Branch Sales Officer",
      stage: "Dropped",
      owner_id: "priya",
      is_archived: true,
      updated_at: "2026-01-23T00:00:00Z",
    };

    const warnings = findDuplicateWarnings(current, [current, previous], [
      { id: "priya", full_name: "Priya Nair" },
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      strength: "strong",
      matchType: "Phone match",
      previousBank: "Axis Bank",
      previousRole: "Branch Sales Officer",
      previousStage: "Dropped",
      previousRecruiter: "Priya Nair",
      isArchived: true,
    });
  });
});

