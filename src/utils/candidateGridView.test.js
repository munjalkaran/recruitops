import { describe, expect, it } from "vitest";
import {
  MATCH_FILTER_OPTIONS,
  UNASSIGNED_RECRUITER,
  applyCandidateGridView,
  cycleCandidateSort,
  filterCandidatesByColumns,
  normalizeSavedCandidateView,
  sortCandidatesForGrid,
} from "./candidateGridView";

const candidates = [
  {
    id: "one",
    name: "Zara",
    stage: "Sourced",
    owner_id: "recruiter-b",
    experience_years: 10,
    fee: 80000,
    actual_joining_date: "",
    next_follow_up: "2026-09-20",
    current_employer: "Northstar",
  },
  {
    id: "two",
    name: "amit",
    stage: "Interviewing",
    owner_id: "recruiter-a",
    experience_years: 2,
    fee: 120000,
    actual_joining_date: "2026-08-02",
    next_follow_up: "2026-09-18",
    current_employer: "Acme Bank",
  },
  {
    id: "three",
    name: "Bea",
    stage: "Contacted",
    owner_id: null,
    experience_years: 6,
    fee: null,
    actual_joining_date: "2026-07-01",
    next_follow_up: "",
    current_employer: "Acme Finance",
  },
];

const context = {
  profiles: [
    { id: "recruiter-a", full_name: "Aarav" },
    { id: "recruiter-b", full_name: "Zoya" },
  ],
  vacancies: [],
  duplicateWarningsByCandidate: {
    two: [{ candidate: { id: "existing" }, isArchived: false }],
    three: [{ candidate: { id: "archived" }, isArchived: true }],
  },
  dismissedDuplicateKeys: new Set(),
};

describe("candidate grid sorting", () => {
  it("cycles ascending, descending, then back to the default order", () => {
    expect(cycleCandidateSort(null, "name")).toEqual({ key: "name", direction: "asc" });
    expect(cycleCandidateSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" });
    expect(cycleCandidateSort({ key: "name", direction: "desc" }, "name")).toBeNull();
  });

  it("sorts text case-insensitively and numbers numerically", () => {
    expect(sortCandidatesForGrid(candidates, { key: "name", direction: "asc" }, context).map(({ id }) => id)).toEqual(["two", "three", "one"]);
    expect(sortCandidatesForGrid(candidates, { key: "experience_years", direction: "asc" }, context).map(({ id }) => id)).toEqual(["two", "three", "one"]);
  });

  it("sorts dates chronologically and keeps missing values last", () => {
    expect(sortCandidatesForGrid(candidates, { key: "actual_joining_date", direction: "desc" }, context).map(({ id }) => id)).toEqual(["two", "three", "one"]);
  });

  it("uses the logical pipeline order for stages", () => {
    expect(sortCandidatesForGrid(candidates, { key: "stage", direction: "asc" }, context).map(({ id }) => id)).toEqual(["one", "three", "two"]);
  });

  it("sorts recruiter display names rather than owner ids", () => {
    expect(sortCandidatesForGrid(candidates, { key: "owner_id", direction: "asc" }, context).map(({ id }) => id)).toEqual(["two", "three", "one"]);
  });
});

describe("candidate grid filtering", () => {
  it("combines text, numeric, and multi-select filters with AND", () => {
    const result = filterCandidatesByColumns(candidates, {
      current_employer: "acme",
      experience_years: { min: "3", max: "8" },
      stage: ["Contacted", "Interviewing"],
    }, context);
    expect(result.map(({ id }) => id)).toEqual(["three"]);
  });

  it("filters recruiter, date presence, and match status", () => {
    expect(filterCandidatesByColumns(candidates, { owner_id: [UNASSIGNED_RECRUITER] }, context).map(({ id }) => id)).toEqual(["three"]);
    expect(filterCandidatesByColumns(candidates, { actual_joining_date: "missing" }, context).map(({ id }) => id)).toEqual(["one"]);
    expect(filterCandidatesByColumns(candidates, { match: [MATCH_FILTER_OPTIONS[1].value] }, context).map(({ id }) => id)).toEqual(["two"]);
  });

  it("applies filters before sorting without mutating the input", () => {
    const original = [...candidates];
    const result = applyCandidateGridView(candidates, {
      columnFilters: { stage: ["Sourced", "Contacted"] },
      sortConfig: { key: "experience_years", direction: "asc" },
    }, context);
    expect(result.map(({ id }) => id)).toEqual(["three", "one"]);
    expect(candidates).toEqual(original);
  });
});

describe("saved candidate views", () => {
  it("maps legacy stage and recruiter filters into column filters", () => {
    expect(normalizeSavedCandidateView({
      stageFilter: "Interviewing",
      recruiterFilter: "unassigned",
    })).toEqual({
      columnFilters: {
        stage: ["Interviewing"],
        owner_id: [UNASSIGNED_RECRUITER],
      },
      sortConfig: null,
    });
  });

  it("keeps valid new filters and sort state", () => {
    expect(normalizeSavedCandidateView({
      columnFilters: { name: "amit", fee: { min: 50000, max: "" } },
      sortConfig: { key: "fee", direction: "desc" },
    })).toEqual({
      columnFilters: { name: "amit", fee: { min: "50000", max: "" } },
      sortConfig: { key: "fee", direction: "desc" },
    });
  });
});
