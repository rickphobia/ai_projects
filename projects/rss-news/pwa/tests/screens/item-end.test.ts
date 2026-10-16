import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InboxItem } from "../../src/api/client";
import { neighbours } from "../../src/screens/item-end";
import { renderItem, type ItemViewOptions } from "../../src/screens/item";
import { FakeApiClient } from "../fake-api";

const STORY: InboxItem = {
  id: 7,
  title: "Bank Negara holds rates",
  url: "https://news.example/7",
  source: "The Star",
  folder: { id: 1, name: "Malaysia" },
  publishedAt: "2026-10-12T04:00:00+00:00",
  importance: 4,
  summary: "Malaysia's central bank kept its policy rate at 2.75%.",
  read: false,
  imageUrl: null,
  stocks: [],
};

// jsdom has no Touch objects, so a touch is a plain event carrying the points it needs. jsdom
// lays nothing out either, so its page is always scrolled to the end.
function touch(
  type: "touchstart" | "touchmove" | "touchend",
  x: number,
  y: number,
): void {
  const event = new Event(type);
  const points = [{ clientX: x, clientY: y }];
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : points,
  });
  Object.defineProperty(event, "changedTouches", { value: points });
  window.dispatchEvent(event);
}

function drag(from: [number, number], to: [number, number]): void {
  touch("touchstart", ...from);
  touch("touchmove", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  touch("touchmove", ...to);
  touch("touchend", ...to);
}

function key(name: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: name }));
}

describe("the end of an Item", () => {
  let root: HTMLElement;
  let api: FakeApiClient;
  let onMove: (itemId: number) => void;
  let onBack: () => void;

  beforeEach(() => {
    root = document.createElement("section");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    api.items = [{ ...STORY }];
    onMove = vi.fn();
    onBack = vi.fn();
  });

  const open = (options: Partial<ItemViewOptions> = {}): Promise<void> =>
    renderItem(root, api, 7, {
      onBack,
      onMove,
      previousId: 6,
      nextId: 8,
      ...options,
    });

  it("marks the Item read and opens the next one from its button", async () => {
    await open();

    screen.getByRole("button", { name: "Mark read: next Item ↓" }).click();

    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith(8);
    });
    expect(api.readMarks).toEqual([[7, true]]);
  });

  it("goes back after the last Item", async () => {
    await open({ nextId: null });

    screen.getByRole("button", { name: "Mark read and go back" }).click();

    await waitFor(() => {
      expect(onBack).toHaveBeenCalled();
    });
    expect(api.readMarks).toEqual([[7, true]]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("doesn't mark a read Item again", async () => {
    api.items = [{ ...STORY, read: true }];
    await open();

    screen.getByRole("button", { name: "Mark read: next Item ↓" }).click();

    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith(8);
    });
    expect(api.readMarks).toEqual([]);
  });

  it("stays and says why when the Item can't be marked read", async () => {
    api.readMarkError = new Error("the server is down");
    await open();

    screen.getByRole("button", { name: "Mark read: next Item ↓" }).click();

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't mark it read: the server is down"),
      ).toBeTruthy();
    });
    expect(onMove).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Mark read: next Item ↓",
      }).disabled,
    ).toBe(false);
  });

  it("finishes the Item when pulled up past the end", async () => {
    await open();

    drag([200, 600], [200, 450]);

    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith(8);
    });
    expect(api.readMarks).toEqual([[7, true]]);
  });

  it("does nothing for a short pull", async () => {
    await open();

    drag([200, 600], [200, 560]);

    expect(api.readMarks).toEqual([]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("finishes the Item when the wheel keeps going past the end", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    await open();
    const wheel = (): void => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 150 }));
    };

    // The scroll that reached the end, then its momentum: neither counts.
    wheel();
    now += 100;
    wheel();
    wheel();
    expect(onMove).not.toHaveBeenCalled();

    now += 500;
    wheel();
    wheel();
    wheel();

    await waitFor(() => {
      expect(onMove).toHaveBeenCalledWith(8);
    });
    expect(api.readMarks).toEqual([[7, true]]);
  });

  it("moves to the next or previous Item with a swipe, leaving it unread", async () => {
    await open();

    drag([600, 300], [400, 310]);
    expect(onMove).toHaveBeenLastCalledWith(8);

    drag([400, 300], [600, 290]);
    expect(onMove).toHaveBeenLastCalledWith(6);
    expect(api.readMarks).toEqual([]);
  });

  it("leaves a swipe from the screen's edge to the phone's back gesture", async () => {
    await open();

    drag([5, 300], [300, 300]);

    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves with the arrow keys, but not while typing", async () => {
    await open();

    key("ArrowRight");
    expect(onMove).toHaveBeenLastCalledWith(8);
    key("ArrowLeft");
    expect(onMove).toHaveBeenLastCalledWith(6);

    const box = document.createElement("input");
    document.body.append(box);
    box.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("goes to the previous Item from its button", async () => {
    await open();

    screen.getByRole("button", { name: "‹ Previous Item" }).click();

    expect(onMove).toHaveBeenCalledWith(6);
  });

  it("has no Previous at the start of the list and no swipe past either end", async () => {
    await open({ previousId: null, nextId: null });

    expect(
      screen.queryByRole("button", { name: "‹ Previous Item" }),
    ).toBeNull();
    key("ArrowRight");
    key("ArrowLeft");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("stops following gestures once the Item is gone", async () => {
    await open();
    root.replaceChildren();

    key("ArrowRight");
    drag([200, 600], [200, 450]);

    expect(onMove).not.toHaveBeenCalled();
    expect(api.readMarks).toEqual([]);
  });
});

describe("neighbours", () => {
  it("finds the Items either side in the list", () => {
    expect(neighbours(2, [3, 2, 1])).toEqual({ previousId: 3, nextId: 1 });
    expect(neighbours(3, [3, 2, 1])).toEqual({ previousId: null, nextId: 2 });
    expect(neighbours(1, [3, 2, 1])).toEqual({ previousId: 2, nextId: null });
    expect(neighbours(9, [3, 2, 1])).toEqual({
      previousId: null,
      nextId: null,
    });
  });
});
