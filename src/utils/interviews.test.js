import { describe, expect, it } from "vitest";
import { getInterviewAttention, isFeedbackDue, interviewMatchesDay } from "./interviews";

const now = new Date("2026-07-31T12:00:00+05:30");

describe("interview workflow rules", () => {
  it("marks scheduled interviews feedback due after the grace period", () => {
    expect(isFeedbackDue({ scheduled_at: "2026-07-31T11:00:00+05:30", interview_status: "Scheduled", feedback_status: "Pending" }, now)).toBe(true);
    expect(isFeedbackDue({ scheduled_at: "2026-07-31T11:45:00+05:30", interview_status: "Scheduled", feedback_status: "Pending" }, now)).toBe(false);
    expect(isFeedbackDue({ scheduled_at: "2026-07-31T10:00:00+05:30", interview_status: "Cancelled", feedback_status: "Pending" }, now)).toBe(false);
  });

  it("surfaces actionable attention reasons", () => {
    const reasons = getInterviewAttention({ scheduled_at: "2026-07-31T10:00:00+05:30", interview_status: "Scheduled", feedback_status: "Pending", candidate_confirmation_status: "Pending", mode: "Video", panel_name: "", meeting_link: "" }, now);
    expect(reasons).toEqual(expect.arrayContaining(["Feedback overdue", "Panel missing", "Meeting link missing"]));
  });

  it("groups interviews by relative day", () => {
    expect(interviewMatchesDay({ scheduled_at: "2026-07-31T14:00:00+05:30" }, 0, now)).toBe(true);
    expect(interviewMatchesDay({ scheduled_at: "2026-08-01T14:00:00+05:30" }, 1, now)).toBe(true);
  });
});
