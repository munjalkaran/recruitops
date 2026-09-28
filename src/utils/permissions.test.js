import { describe, expect, it } from "vitest";
import { isCandidateStale } from "./candidateUtils";
import {
  canAccessInvoicing,
  canAccessPage,
  canArchiveCandidate,
  canCreateCandidate,
  canManageDemoData,
  canDirectlyEditCandidateField,
  canPermanentlyDeleteCandidate,
  canRequestCandidateChange,
  canRestoreCandidate,
  getVisibleNavItems,
} from "./permissions";

const admin = { id: "admin-id", role: "admin" };
const recruiter = { id: "recruiter-id", role: "recruiter" };
const otherRecruiter = { id: "other-id", role: "recruiter" };
const assignedCandidate = { owner_id: recruiter.id, is_archived: false };
const adminOnlyCandidateFields = [
  "retention_period_days",
  "retention_start_date",
  "retention_due_date",
  "retention_status",
  "replacement_guarantee_end_date",
];

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

  it("keeps the profile page reachable for every authenticated role without adding it to nav", () => {
    expect(canAccessPage(admin, "profile")).toBe(true);
    expect(canAccessPage(recruiter, "profile")).toBe(true);
    expect(canAccessPage(null, "profile")).toBe(false);
    expect(getVisibleNavItems(admin).some((item) => item.id === "profile")).toBe(false);
    expect(getVisibleNavItems(recruiter).some((item) => item.id === "profile")).toBe(false);
  });

  it("allows a recruiter to operate only on their assigned candidate", () => {
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "stage")).toBe(true);
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "notes")).toBe(true);
    expect(canArchiveCandidate(recruiter, assignedCandidate)).toBe(true);
    expect(canDirectlyEditCandidateField(otherRecruiter, assignedCandidate, "stage")).toBe(false);
    expect(canArchiveCandidate(otherRecruiter, assignedCandidate)).toBe(false);
  });

  it("keeps retention fields admin-only", () => {
    adminOnlyCandidateFields.forEach((field) => {
      expect(canDirectlyEditCandidateField(admin, assignedCandidate, field)).toBe(true);
      expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, field)).toBe(false);
    });
    expect(canDirectlyEditCandidateField(recruiter, assignedCandidate, "actual_joining_date")).toBe(true);
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
