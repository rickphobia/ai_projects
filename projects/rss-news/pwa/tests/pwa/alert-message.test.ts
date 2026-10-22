import { describe, expect, it } from "vitest";

import { alertFromPushData, alertPageUrl } from "../../src/pwa/alert-message";
import { itemIdInPageUrl } from "../../src/pwa/opened-item";

const scope = "https://rickphobia.com/ai-projects/rss-news/";

describe("an Alert's push message", () => {
  it("is read from the server's JSON", () => {
    expect(
      alertFromPushData(
        JSON.stringify({ title: "Fed holds rates", body: "Why", item_id: 42 }),
      ),
    ).toEqual({
      title: "Fed holds rates",
      body: "Why",
      itemId: 42,
      briefingId: null,
    });
  });

  it("reads the Briefing a finished Briefing's Alert opens", () => {
    expect(
      alertFromPushData(
        JSON.stringify({
          title: "Your Briefing is ready",
          body: "All Sources, last 24 hours. Tap to read it.",
          item_id: null,
          briefing_id: 5,
        }),
      ).briefingId,
    ).toBe(5);
  });

  it("still shows when it isn't the JSON the server sends", () => {
    expect(alertFromPushData("plain words")).toEqual({
      title: "rss-news",
      body: "plain words",
      itemId: null,
      briefingId: null,
    });
    expect(alertFromPushData(null)).toEqual({
      title: "rss-news",
      body: "",
      itemId: null,
      briefingId: null,
    });
    expect(
      alertFromPushData(JSON.stringify({ title: "T", item_id: "42" })).itemId,
    ).toBeNull();
  });
});

describe("the page a tapped Alert opens", () => {
  it("is the app on the Alert's Item, which the app reads back", () => {
    const url = alertPageUrl(42, scope);

    expect(url).toBe(`${scope}?item=42`);
    expect(itemIdInPageUrl(url)).toBe(42);
  });

  it("is the app on the Briefing for a finished Briefing's Alert", () => {
    expect(alertPageUrl(null, scope, 5)).toBe(`${scope}#briefings/5`);
  });

  it("is the app itself for an Alert without an Item", () => {
    expect(alertPageUrl(null, scope)).toBe(scope);
    expect(itemIdInPageUrl(scope)).toBeNull();
  });

  it("ignores an item that isn't an Item id", () => {
    expect(itemIdInPageUrl(`${scope}?item=abc`)).toBeNull();
    expect(itemIdInPageUrl(`${scope}?item=-3`)).toBeNull();
    expect(itemIdInPageUrl(`${scope}?item=`)).toBeNull();
  });
});
