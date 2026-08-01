import { describe, expect, it } from "vitest";
import { resolveDemoRows, shouldUseDemoFallback } from "./demoFallback";

describe("development demo fallback", () => {
  it("uses local records only when development fallback is allowed and remote data is unavailable", () => {
    expect(shouldUseDemoFallback({ development: true, allowDevelopmentFallback: true, remoteRows: [], remoteError: { code: "42P01" } })).toBe(true);
    expect(resolveDemoRows([], ["local"], true)).toEqual(["local"]);
  });

  it("does not mix or replace healthy remote data", () => {
    expect(shouldUseDemoFallback({ development: true, sampleDataActive: true, remoteRows: [{ id: "remote" }] })).toBe(false);
    expect(resolveDemoRows([{ id: "remote" }], [{ id: "local" }], false)).toEqual([{ id: "remote" }]);
  });

  it("switches the complete demo set together when one collection is unavailable", () => {
    expect(shouldUseDemoFallback({
      development: true,
      sampleDataActive: true,
      collections: [
        { rows: [{ id: "remote-candidate" }] },
        { rows: [], error: { code: "42P01" } },
        { rows: [{ id: "remote-interview" }] },
      ],
    })).toBe(true);
  });

  it("never uses local demo data in production", () => {
    expect(shouldUseDemoFallback({ development: false, allowDevelopmentFallback: true, sampleDataActive: true, remoteRows: [], remoteError: new Error("missing") })).toBe(false);
  });
});
