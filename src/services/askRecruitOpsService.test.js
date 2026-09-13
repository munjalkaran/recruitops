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

  it("explains 90-day invoice eligibility and flags missing joining dates", () => {
    const response = interpretRecruitOpsQuestion("Which joined candidates are ready for invoicing?", {
      candidates: [
        { id: "1", stage: "Joined", is_archived: false, actual_joining_date: "2020-01-01", retention_status: "Completed" },
        { id: "2", stage: "Joined", is_archived: false, actual_joining_date: "", retention_status: "Not Started" },
        { id: "3", stage: "Joined", is_archived: false, actual_joining_date: "2020-01-01", retention_status: "Failed" },
      ],
    });

    expect(response.action.kind).toBe("invoicing");
    expect(response.message).toContain("1 candidate is eligible");
    expect(response.message).toContain("day 90");
    expect(response.message).toContain("1 joined candidate still needs an actual joining date");
  });
});
