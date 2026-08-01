import { describe, expect, it } from "vitest";
import { FINALIZED_INVOICE_DELETE_MESSAGE, getPermanentDeleteErrorMessage } from "./permanentDelete";

describe("permanent deletion error handling", () => {
  it("keeps finalised invoice records protected", () => {
    expect(getPermanentDeleteErrorMessage(new Error("candidate has a finalised invoice"))).toBe(FINALIZED_INVOICE_DELETE_MESSAGE);
  });

  it("does not expose raw permission or network errors", () => {
    expect(getPermanentDeleteErrorMessage(new Error("new row violates row-level security policy"))).toContain("permission");
    expect(getPermanentDeleteErrorMessage(new Error("Failed to fetch"))).toContain("data service");
  });
});
