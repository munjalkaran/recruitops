import { describe, expect, it } from "vitest";
import {
  excludeRemovedDemoCandidates,
  getCandidatesVisibleToProfile,
  summarizeDemoData,
} from "./demoData";

const realCandidate = { id: "real", owner_id: "priya", is_demo: false };
const activeDemo = { id: "active-demo", owner_id: "priya", is_demo: true, demo_removed_at: null };
const removedDemo = {
  id: "removed-demo",
  owner_id: "priya",
  is_demo: true,
  demo_removed_at: "2026-07-23T10:00:00Z",
};
const otherRecruiterDemo = { id: "arjun-demo", owner_id: "arjun", is_demo: true };

describe("demo candidate visibility", () => {
  it("excludes soft-removed sample candidates without affecting real data", () => {
    expect(excludeRemovedDemoCandidates([realCandidate, activeDemo, removedDemo])).toEqual([
      realCandidate,
      activeDemo,
    ]);
  });

  it("restores the same sample record without creating a duplicate", () => {
    const restored = { ...removedDemo, demo_removed_at: null, demo_removed_by: null };
    const visible = excludeRemovedDemoCandidates([realCandidate, restored]);
    expect(visible.map((candidate) => candidate.id)).toEqual(["real", "removed-demo"]);
    expect(new Set(visible.map((candidate) => candidate.id)).size).toBe(2);
  });

  it("shows recruiters only their assigned active samples", () => {
    const visible = getCandidatesVisibleToProfile(
      [realCandidate, activeDemo, removedDemo, otherRecruiterDemo],
      { id: "priya", role: "recruiter" },
    );
    expect(visible.map((candidate) => candidate.id)).toEqual(["real", "active-demo"]);
  });

  it("normalizes active and removed batch status", () => {
    expect(summarizeDemoData({ status: "active", candidate_count: "19" })).toMatchObject({
      isActive: true,
      count: 19,
    });
    expect(summarizeDemoData({ status: "removed", candidate_count: 19 })).toMatchObject({
      isRemoved: true,
      count: 19,
    });
  });
});

