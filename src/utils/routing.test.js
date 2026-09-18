import { describe, expect, it } from "vitest";
import { pageFromPath, pathFromPage } from "./routing";

describe("Telora routing", () => {
  it("normalizes direct routes and unknown paths", () => {
    expect(pageFromPath("/pipeline")).toBe("pipeline");
    expect(pageFromPath("/profile")).toBe("profile");
    expect(pageFromPath("/administration")).toBe("administration");
    expect(pageFromPath("/settings")).toBe("administration");
    expect(pageFromPath("/missing")).toBe("overview");
    expect(pathFromPage("settings")).toBe("/administration");
    expect(pathFromPage("administration")).toBe("/administration");
    expect(pathFromPage("profile")).toBe("/profile");
  });
});
