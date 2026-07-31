import { describe, expect, it } from "vitest";
import { mockCandidates } from "./mockCandidates";
import { mockInterviews } from "./mockInterviews";
import { mockVacancies } from "./mockVacancies";

describe("Telora demo workflow data", () => {
  it("covers six vacancies and linked enriched candidates", () => {
    expect(mockVacancies).toHaveLength(6);
    expect(mockVacancies.map((vacancy) => vacancy.client_name)).toContain("Bajaj Finance");
    expect(mockCandidates.filter((candidate) => candidate.vacancy_id).length).toBeGreaterThan(10);
    expect(mockCandidates.some((candidate) => candidate.stage === "Joined" && candidate.actual_joining_date)).toBe(true);
    expect(mockCandidates.some((candidate) => candidate.current_ctc && candidate.expected_ctc && candidate.current_location)).toBe(true);
  });

  it("covers feedback, no-show, reschedule and scorecard examples", () => {
    expect(mockInterviews.some((interview) => interview.feedback_status === "Pending")).toBe(true);
    expect(mockInterviews.some((interview) => interview.interview_status === "No Show")).toBe(true);
    expect(mockInterviews.some((interview) => interview.interview_status === "Rescheduled")).toBe(true);
    expect(mockInterviews.some((interview) => interview.technical_fit_score)).toBe(true);
  });
});
