export const isActiveCandidate = (candidate) =>
  !candidate?.is_demo || !candidate?.demo_removed_at;

export const excludeRemovedDemoCandidates = (candidates = []) =>
  candidates.filter(isActiveCandidate);

export const getCandidatesVisibleToProfile = (candidates = [], profile) => {
  const active = excludeRemovedDemoCandidates(candidates);
  if (!profile) return [];
  if (profile.role === "admin") return active;
  return active.filter((candidate) => candidate.owner_id === profile.id);
};

export const summarizeDemoData = (status) => ({
  status: status?.status || "not_seeded",
  count: Number(status?.candidate_count) || 0,
  isActive: status?.status === "active",
  isRemoved: status?.status === "removed",
});

