import { describe, expect, it } from "vitest";
import {
  PointerGestures,
  tileAtPoint,
} from "../../../src/adapters/input/board-pointer";

describe("tileAtPoint", () => {
  it("finds the tile a point is inside", () => {
    expect(tileAtPoint({ x: 0, y: 0 }, 64)).toEqual({ column: 0, row: 0 });
    expect(tileAtPoint({ x: 63.9, y: 64 }, 64)).toEqual({ column: 0, row: 1 });
    expect(tileAtPoint({ x: 1279, y: 895 }, 64)).toEqual({
      column: 19,
      row: 13,
    });
  });

  it("is null off the Board", () => {
    expect(tileAtPoint({ x: -1, y: 10 }, 64)).toBeNull();
    expect(tileAtPoint({ x: 1280, y: 10 }, 64)).toBeNull();
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
});
