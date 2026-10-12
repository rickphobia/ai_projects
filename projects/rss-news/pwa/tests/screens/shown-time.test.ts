import { describe, expect, it } from "vitest";

import { relativeTime, shownDate } from "../../src/screens/shown-time";

describe("relative time on Inbox rows", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const before = (seconds: number): Date =>
    new Date(now.getTime() - seconds * 1000);

  it("says now for the last minute", () => {
    expect(relativeTime(before(30), now)).toBe("now");
  });

  it("counts minutes, hours and days", () => {
    expect(relativeTime(before(5 * 60), now)).toBe("5m");
    expect(relativeTime(before(3 * 3600 + 59), now)).toBe("3h");
    expect(relativeTime(before(6 * 86400), now)).toBe("6d");
  });

  it("shows the date from a week back", () => {
    const old = before(8 * 86400);
    expect(relativeTime(old, now)).toBe(shownDate.format(old));
  });

  it("says now for a time slightly ahead, as clocks drift", () => {
    expect(relativeTime(before(-20), now)).toBe("now");
  });
});
