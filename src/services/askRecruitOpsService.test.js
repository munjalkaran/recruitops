import { describe, expect, it } from "vitest";
import { interpretRecruitOpsQuestion } from "./askRecruitOpsService";

describe("Telora AI interview fallbacks", () => {
  it("answers interview questions from available records", () => {
    const response = interpretRecruitOpsQuestion("Show interviews scheduled today", {
      interviews: [{ scheduled_at: new Date().toISOString(), round_type: "TP1", interview_status: "Scheduled" }],
    });
    expect(response.action.kind).toBe("interviews");
    expect(response.message).toContain("scheduled today");
  });

  it("reports missing vacancy linkage without inventing records", () => {
    const response = interpretRecruitOpsQuestion("Which candidates have no linked vacancy?", {
      candidates: [{ id: "1", name: "A", is_archived: false, vacancy_id: null }],
    });
    expect(response.message).toContain("1 candidate");
  });

  it("answers notice period questions from candidate fields", () => {
    const response = interpretRecruitOpsQuestion("Which candidates can join within 30 days?", {
      candidates: [{ id: "1", name: "A", is_archived: false, notice_period_days: 15 }],
    });
    expect(response.message).toContain("1 candidate");
  });
});
