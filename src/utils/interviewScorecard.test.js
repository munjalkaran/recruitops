import { describe, expect, it } from "vitest";
import { formatScorecardAverage, getScorecardAverage } from "./interviewScorecard";

describe("interview scorecards", () => {
  it("averages only valid scores", () => {
    expect(getScorecardAverage({ technical_fit_score: 5, communication_score: 4, role_fit_score: 3, stability_motivation_score: null })).toBe(4);
    expect(formatScorecardAverage({})).toBe("Not scored");
  });
});
