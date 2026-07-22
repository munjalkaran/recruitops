import { describe, expect, it } from "vitest";
import { isCandidateStale } from "./candidateUtils";
import {
  canAccessInvoicing,
  canArchiveCandidate,
  canCreateCandidate,
  canManageDemoData,
  canDirectlyEditCandidateField,
  canPermanentlyDeleteCandidate,
  canRequestCandidateChange,
  canRestoreCandidate,
} from "./permissions";

const admin = { id: "admin-id", role: "admin" };
const recruiter = { id: "recruiter-id", role: "recruiter" };
const otherRecruiter = { id: "other-id", role: "recruiter" };
const assignedCandidate = { owner_id: recruiter.id, is_archived: false };

describe("RecruitOps permissions", () => {
  it("keeps Admin-only actions restricted", () => {
    expect(canCreateCandidate(admin)).toBe(true);
    expect(canManageDemoData(admin)).toBe(true);
    expect(canAccessInvoicing(admin)).toBe(true);
    expect(canRestoreCandidate(admin)).toBe(true);
    expect(canPermanentlyDeleteCandidate(admin)).toBe(true);
    expect(canPermanentlyDeleteCandidate(admin, { is_demo: true })).toBe(false);
    expect(canCreateCandidate(recruiter)).toBe(false);
    expect(canManageDemoData(recruiter)).toBe(false);
    expect(canAccessInvoicing(recruiter)).toBe(false);
    expect(canRestoreCandidate(recruiter)).toBe(false);
    expect(canPermanentlyDeleteCandidate(recruiter)).toBe(false);
  });

  it("allows a recruiter to operate only on their assigned candidate", () => {
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "stage")).toBe(true);
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "notes")).toBe(true);
    expect(canArchiveCandidate(recruiter, assignedCandidate)).toBe(true);
    expect(canDirectlyEditCandidateField(otherRecruiter, assignedCandidate, "stage")).toBe(false);
    expect(canArchiveCandidate(otherRecruiter, assignedCandidate)).toBe(false);
  });

  it("routes protected recruiter edits through change requests", () => {
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "phone")).toBe(false);
    expect(canRequestCandidateChange(recruiter, assignedCandidate, "phone")).toBe(true);
    expect(canRequestCandidateChange(recruiter, assignedCandidate, "owner_id")).toBe(true);
  });
});

describe("stale candidates", () => {
  it("flags overdue open candidates and ignores closed stages", () => {
    expect(isCandidateStale({ next_follow_up: "2026-07-01", stage: "Screened" }, "2026-07-22")).toBe(true);
    expect(isCandidateStale({ next_follow_up: "2026-07-01", stage: "Joined" }, "2026-07-22")).toBe(false);
    expect(isCandidateStale({ next_follow_up: "", stage: "Screened" }, "2026-07-22")).toBe(false);
  });
});
