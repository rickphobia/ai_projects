import { describe, expect, it } from "vitest";
import {
  PointerGestures,
  tileAtPoint,
} from "../../../src/adapters/input/board-pointer";

describe("tileAtPoint", () => {
  it("finds the tile a point is inside", () => {
    expect(tileAtPoint({ x: 0, y: 0 }, 64)).toEqual({ column: 0, row: 0 });
    expect(tileAtPoint({ x: 63.9, y: 64 }, 64)).toEqual({ column: 0, row: 1 });
    expect(tileAtPoint({ x: 1407, y: 895 }, 64)).toEqual({
      column: 21,
      row: 13,
    });
  });

  it("is null off the Board", () => {
    expect(tileAtPoint({ x: -1, y: 10 }, 64)).toBeNull();
    expect(tileAtPoint({ x: 1408, y: 10 }, 64)).toBeNull();
    expect(tileAtPoint({ x: 10, y: 896 }, 64)).toBeNull();
  });
});

describe("PointerGestures", () => {
  const record = () => {
    const events: string[] = [];
    const gestures = new PointerGestures({
      onHover: (point) => events.push(point === null ? "leave" : "hover"),
      onTap: (point, kind) =>
        events.push(`tap ${kind} ${String(point.x)},${String(point.y)}`),
      onPan: (dx, dy) => events.push(`pan ${String(dx)},${String(dy)}`),
      onZoom: (_centre, factor) => events.push(`zoom ${String(factor)}`),
    });
    return { events, gestures };
  };
  const finger = (id: number, x: number, y: number) => ({
    id,
    kind: "touch" as const,
    point: { x, y },
  });

  it("taps when a press barely moves", () => {
    const { events, gestures } = record();
    gestures.press(finger(1, 10, 10));
    gestures.move(finger(1, 14, 12));
    gestures.release(finger(1, 14, 12));
    expect(events).toEqual(["tap touch 14,12"]);
  });

  it("pans on a drag and never taps at the end of it", () => {
    const { events, gestures } = record();
    gestures.press(finger(1, 10, 10));
    gestures.move(finger(1, 40, 10));
    gestures.move(finger(1, 45, 20));
    gestures.release(finger(1, 45, 20));
    expect(events).toEqual(["pan 30,0", "pan 5,10"]);
  });

  it("zooms on a pinch and doesn't tap when the fingers lift", () => {
    const { events, gestures } = record();
    gestures.press(finger(1, 100, 100));
    gestures.press(finger(2, 200, 100));
    gestures.move(finger(2, 300, 100));
    gestures.release(finger(2, 300, 100));
    gestures.release(finger(1, 100, 100));
    expect(events).toEqual(["zoom 2", "pan 50,0"]);
  });

  it("hovers only for a mouse with no button held", () => {
    const { events, gestures } = record();
    gestures.move({ id: 1, kind: "mouse", point: { x: 5, y: 5 } });
    gestures.move(finger(2, 5, 5));
    gestures.leave();
    expect(events).toEqual(["hover", "leave"]);
  });

  describe("painting", () => {
    /** Paints only left of x = 100, as if that were the Spawn zone with a brush chosen. */
    const recordPaint = (brush = true) => {
      const events: string[] = [];
      const gestures = new PointerGestures({
        onHover: () => events.push("hover"),
        onTap: () => events.push("tap"),
        onPan: (dx, dy) => events.push(`pan ${String(dx)},${String(dy)}`),
        onZoom: (_centre, factor) => events.push(`zoom ${String(factor)}`),
        paint: {
          canPaintAt: (point) => brush && point.x < 100,
          onPaintStart: (point) =>
            events.push(`start ${String(point.x)},${String(point.y)}`),
          onPaintMove: (point) =>
            events.push(`paint ${String(point.x)},${String(point.y)}`),
          onPaintEnd: () => events.push("end"),
        },
      });
      return { events, gestures };
    };

    it("paints a drag that starts in the zone, and never pans or taps", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 10, 10));
      gestures.move(finger(1, 40, 10));
      gestures.move(finger(1, 200, 30));
      gestures.release(finger(1, 200, 30));
      expect(events).toEqual([
        "start 10,10",
        "paint 40,10",
        "paint 200,30",
        "end",
      ]);
    });

    it("paints one Dude for a tap in the zone, not a tap", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 10, 10));
      gestures.release(finger(1, 10, 10));
      expect(events).toEqual(["start 10,10", "end"]);
    });

    it("adds nothing while the pointer is held still", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 10, 10));
      gestures.move(finger(1, 10, 10));
      gestures.move(finger(1, 10, 10));
      expect(events).toEqual(["start 10,10"]);
    });

    it("pans a drag that starts outside the zone, even into it", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 150, 10));
      gestures.move(finger(1, 50, 10));
      gestures.release(finger(1, 50, 10));
      expect(events).toEqual(["pan -100,0"]);
    });

    it("pans when no brush is chosen", () => {
      const { events, gestures } = recordPaint(false);
      gestures.press(finger(1, 10, 10));
      gestures.move(finger(1, 40, 10));
      gestures.release(finger(1, 40, 10));
      expect(events).toEqual(["pan 30,0"]);
    });

    it("turns a paint into a pinch when a second finger lands", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 10, 10));
      gestures.press(finger(2, 60, 10));
      gestures.move(finger(2, 110, 10));
      gestures.release(finger(2, 110, 10));
      gestures.release(finger(1, 10, 10));
      expect(events).toEqual(["start 10,10", "end", "zoom 2", "pan 25,0"]);
    });

    it("ends the paint when the browser takes the pointer away", () => {
      const { events, gestures } = recordPaint();
      gestures.press(finger(1, 10, 10));
      gestures.cancel(finger(1, 10, 10));
      gestures.move(finger(1, 30, 10));
      expect(events).toEqual(["start 10,10", "end"]);
    });
  });
});
