import { describe, expect, it } from "vitest";

import {
  backLabel,
  routeFromHash,
  routeHash,
  type Route,
} from "../../src/screens/routes";

const ROUTES: [Route, string][] = [
  [{ screen: "home" }, "#home"],
  [{ screen: "inbox" }, "#inbox"],
  [{ screen: "inbox", folderId: 3 }, "#inbox/folder/3"],
  [{ screen: "item", itemId: 4131 }, "#items/4131"],
  [{ screen: "briefings" }, "#briefings"],
  [{ screen: "briefing", briefingId: 12 }, "#briefings/12"],
  [{ screen: "notes" }, "#notes"],
  [{ screen: "note-briefing", briefingId: 5 }, "#notes/briefing/5"],
  [{ screen: "sources" }, "#sources"],
  [{ screen: "stocks" }, "#stocks"],
  [{ screen: "settings" }, "#settings"],
];

describe("routes", () => {
  it.each(ROUTES)("writes %j as %s and reads it back", (route, hash) => {
    expect(routeHash(route)).toBe(hash);
    expect(routeFromHash(hash)).toEqual(route);
  });

  it.each(["", "#", "#nowhere", "#items/abc", "#items/0", "#inbox/folder/-1"])(
    "reads %j as Home",
    (hash) => {
      expect(routeFromHash(hash)).toEqual({ screen: "home" });
    },
  );

  it("names the screen an Item's back button returns to", () => {
    expect(backLabel(null)).toBe("Back to Home");
    expect(backLabel({ screen: "home" })).toBe("Back to Home");
    expect(backLabel({ screen: "inbox", folderId: 2 })).toBe("Back to Inbox");
    expect(backLabel({ screen: "briefing", briefingId: 1 })).toBe(
      "Back to Briefings",
    );
    expect(backLabel({ screen: "note-briefing", briefingId: 1 })).toBe(
      "Back to Notes",
    );
    expect(backLabel({ screen: "item", itemId: 1 })).toBe("Back");
  });
});
