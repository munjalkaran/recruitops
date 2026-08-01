export const SCORECARD_FIELDS = [
  ["technical_fit_score", "Technical fit"],
  ["communication_score", "Communication"],
  ["role_fit_score", "Role fit"],
  ["stability_motivation_score", "Stability and motivation"],
];

export const getScorecardAverage = (interview) => {
  const scores = SCORECARD_FIELDS
    .map(([field]) => Number(interview?.[field]))
    .filter((score) => Number.isFinite(score) && score >= 1 && score <= 5);
  return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
};

export const formatScorecardAverage = (interview) => {
  const average = getScorecardAverage(interview);
  return average === null ? "Not scored" : `${average.toFixed(1)} / 5`;
};
