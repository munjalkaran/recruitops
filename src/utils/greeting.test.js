import { describe, expect, it } from "vitest";
import { getTimeAwareGreeting } from "./greeting";

const profile = { full_name: "Karan Munjal", role: "admin" };

describe("time-aware overview greeting", () => {
  it.each([
    [5, "Good morning, Karan. Ready for the day?"],
    [11, "Good morning, Karan. Ready for the day?"],
    [12, "Good afternoon, Karan. Here’s what needs attention."],
    [16, "Good afternoon, Karan. Here’s what needs attention."],
    [17, "Good evening, Karan. Let’s close the day well."],
    [21, "Good evening, Karan. Let’s close the day well."],
    [22, "Working late, Karan? Let’s keep it focused."],
    [4, "Working late, Karan? Let’s keep it focused."],
  ])("uses the correct local time band at %s:00", (hour, expected) => {
    expect(getTimeAwareGreeting(profile, new Date(2026, 7, 1, hour))).toBe(expected);
  });

  it("falls back to the role only when a name is unavailable", () => {
    expect(getTimeAwareGreeting({ role: "admin" }, new Date(2026, 7, 1, 9))).toBe(
      "Good morning, Admin. Ready for the day?",
    );
  });
});
