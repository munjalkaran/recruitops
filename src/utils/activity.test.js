import { describe, expect, it } from "vitest";
import { buildCandidateActivity } from "./activity";

describe("candidate activity", () => {
  it("combines audit and interview history newest first", () => {
    const rows = buildCandidateActivity({ id: "c1" }, [{ id: "a1", candidate_id: "c1", action: "created", created_at: "2026-01-01" }], [{ id: "i1", candidate_id: "c1", interview_status: "Scheduled", scheduled_at: "2026-02-01" }]);
    expect(rows[0].type).toBe("interview");
    expect(rows[1].summary).toBe("Candidate added");
  });
});
