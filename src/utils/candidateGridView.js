import { PIPELINE_STAGES } from "../constants/pipeline";

export const UNASSIGNED_RECRUITER = "__unassigned__";

export const MATCH_FILTER_OPTIONS = [
  { value: "clear", label: "Clear" },
  { value: "possible_duplicate", label: "Possible duplicate" },
  { value: "previous_candidate", label: "Previous candidate" },
];

export const CANDIDATE_GRID_FILTER_TYPES = {
  name: "text",
  match: "multi",
  phone: "text",
  current_employer: "text",
  experience_years: "number",
  target_bank: "text",
  role: "text",
  stage: "multi",
  actual_joining_date: "date",
  owner_id: "multi",
  docs_status: "multi",
  fee: "number",
  next_follow_up: "date",
  last_contact: "date",
  notes: "text",
  email: "text",
  vacancy_id: "text",
  current_ctc: "number",
  expected_ctc: "number",
  current_location: "text",
};

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const matchOrder = MATCH_FILTER_OPTIONS.map(({ value }) => value);

const isPresent = (value) => value !== null && value !== undefined && value !== "";

const toFiniteNumber = (value) => {
  if (!isPresent(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getVisibleWarning = (candidate, context) =>
  (context.duplicateWarningsByCandidate?.[candidate.id] || []).find(
    (warning) => !context.dismissedDuplicateKeys?.has(`${candidate.id}:${warning.candidate.id}`),
  );

export function getCandidateMatchValue(candidate, context = {}) {
  const warning = getVisibleWarning(candidate, context);
  if (!warning) return "clear";
  return warning.isArchived ? "previous_candidate" : "possible_duplicate";
}

export function getCandidateGridValue(candidate, key, context = {}) {
  if (key === "match") return getCandidateMatchValue(candidate, context);
  if (key === "owner_id") return candidate.owner_id || UNASSIGNED_RECRUITER;
  if (key === "vacancy_id") {
    return context.vacancies?.find((vacancy) => vacancy.id === candidate.vacancy_id)?.job_title || "";
  }
  return candidate[key];
}

function getCandidateSortValue(candidate, key, context) {
  if (key === "owner_id") {
    if (!candidate.owner_id) return "Unassigned";
    return context.profiles?.find((profile) => profile.id === candidate.owner_id)?.full_name || "";
  }
  return getCandidateGridValue(candidate, key, context);
}

export function isCandidateColumnFilterActive(key, filter) {
  const type = CANDIDATE_GRID_FILTER_TYPES[key];
  if (type === "text") return Boolean(String(filter || "").trim());
  if (type === "multi") return Array.isArray(filter) && filter.length > 0;
  if (type === "date") return filter === "has" || filter === "missing";
  if (type === "number") {
    return isPresent(filter?.min) || isPresent(filter?.max);
  }
  return false;
}

export function normalizeCandidateColumnFilters(columnFilters = {}) {
  return Object.entries(columnFilters).reduce((normalized, [key, filter]) => {
    const type = CANDIDATE_GRID_FILTER_TYPES[key];
    if (!type) return normalized;

    let nextFilter = filter;
    if (type === "text") nextFilter = String(filter || "");
    if (type === "multi") {
      nextFilter = [...new Set((Array.isArray(filter) ? filter : []).map(String))];
    }
    if (type === "number") {
      nextFilter = {
        min: isPresent(filter?.min) ? String(filter.min) : "",
        max: isPresent(filter?.max) ? String(filter.max) : "",
      };
    }

    if (isCandidateColumnFilterActive(key, nextFilter)) normalized[key] = nextFilter;
    return normalized;
  }, {});
}

export function normalizeCandidateSort(sortConfig) {
  if (!CANDIDATE_GRID_FILTER_TYPES[sortConfig?.key]) return null;
  if (!["asc", "desc"].includes(sortConfig?.direction)) return null;
  return { key: sortConfig.key, direction: sortConfig.direction };
}

export function normalizeSavedCandidateView(filters = {}) {
  const columnFilters = normalizeCandidateColumnFilters(filters.columnFilters);

  if (!columnFilters.stage && filters.stageFilter) {
    columnFilters.stage = [String(filters.stageFilter)];
  }
  if (
    !columnFilters.owner_id &&
    filters.recruiterFilter &&
    filters.recruiterFilter !== "all"
  ) {
    columnFilters.owner_id = [
      filters.recruiterFilter === "unassigned"
        ? UNASSIGNED_RECRUITER
        : String(filters.recruiterFilter),
    ];
  }

  return {
    columnFilters: normalizeCandidateColumnFilters(columnFilters),
    sortConfig: normalizeCandidateSort(filters.sortConfig),
  };
}

export function cycleCandidateSort(sortConfig, key) {
  if (sortConfig?.key !== key) return { key, direction: "asc" };
  if (sortConfig.direction === "asc") return { key, direction: "desc" };
  return null;
}

function matchesCandidateFilter(candidate, key, filter, context) {
  const type = CANDIDATE_GRID_FILTER_TYPES[key];
  const value = getCandidateGridValue(candidate, key, context);

  if (type === "text") {
    return String(value || "").toLocaleLowerCase().includes(String(filter).trim().toLocaleLowerCase());
  }
  if (type === "multi") return filter.includes(String(value));
  if (type === "date") return filter === "has" ? isPresent(value) : !isPresent(value);
  if (type === "number") {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return false;
    const minimum = toFiniteNumber(filter.min);
    const maximum = toFiniteNumber(filter.max);
    return (minimum === null || numericValue >= minimum) && (maximum === null || numericValue <= maximum);
  }
  return true;
}

export function filterCandidatesByColumns(candidates, columnFilters = {}, context = {}) {
  const activeFilters = Object.entries(normalizeCandidateColumnFilters(columnFilters));
  if (!activeFilters.length) return candidates;
  return candidates.filter((candidate) =>
    activeFilters.every(([key, filter]) => matchesCandidateFilter(candidate, key, filter, context)),
  );
}

function compareCandidateValues(left, right, key, context, direction) {
  const leftValue = getCandidateSortValue(left, key, context);
  const rightValue = getCandidateSortValue(right, key, context);
  const leftMissing = !isPresent(leftValue);
  const rightMissing = !isPresent(rightValue);

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  if (["experience_years", "fee", "current_ctc", "expected_ctc"].includes(key)) {
    return (toFiniteNumber(leftValue) - toFiniteNumber(rightValue)) * direction;
  }
  if (["actual_joining_date", "next_follow_up", "last_contact"].includes(key)) {
    return (Date.parse(leftValue) - Date.parse(rightValue)) * direction;
  }
  if (key === "stage") {
    return (PIPELINE_STAGES.indexOf(leftValue) - PIPELINE_STAGES.indexOf(rightValue)) * direction;
  }
  if (key === "match") {
    return (matchOrder.indexOf(leftValue) - matchOrder.indexOf(rightValue)) * direction;
  }
  return textCollator.compare(String(leftValue), String(rightValue)) * direction;
}

export function sortCandidatesForGrid(candidates, sortConfig, context = {}) {
  const normalizedSort = normalizeCandidateSort(sortConfig);
  if (!normalizedSort) return candidates;
  const direction = normalizedSort.direction === "asc" ? 1 : -1;

  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const comparison = compareCandidateValues(
        left.candidate,
        right.candidate,
        normalizedSort.key,
        context,
        direction,
      );
      if (comparison === 0) return left.index - right.index;
      return comparison;
    })
    .map(({ candidate }) => candidate);
}

export function applyCandidateGridView(candidates, view = {}, context = {}) {
  const filtered = filterCandidatesByColumns(candidates, view.columnFilters, context);
  return sortCandidatesForGrid(filtered, view.sortConfig, context);
}

export function countActiveCandidateColumnFilters(columnFilters = {}) {
  return Object.entries(columnFilters).filter(([key, filter]) =>
    isCandidateColumnFilterActive(key, filter),
  ).length;
}
