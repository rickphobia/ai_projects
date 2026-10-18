import { isOnBoard, type Tile } from "../../maze/board";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type PointerKind = "mouse" | "touch";

/** What the camera and the game hear from the pointer, in screen pixels of the canvas. */
export interface PointerHandlers {
  /** The mouse is over this point with no button held, or null once it leaves. Never fires for touch. */
  readonly onHover: (point: Point | null) => void;
  /** A press and release that barely moved: place a Piece or ask what one does. */
  readonly onTap: (point: Point, kind: PointerKind) => void;
  readonly onPan: (dx: number, dy: number) => void;
  /** Two fingers moved apart (factor > 1) or together, around `centre`. */
  readonly onZoom: (centre: Point, factor: number) => void;
}

export interface PointerSample {
  readonly id: number;
  readonly kind: PointerKind;
  readonly point: Point;
}

/** How far a press may wander and still count as a tap. A finger wobbles more than a mouse. */
const TAP_SLOP: Readonly<Record<PointerKind, number>> = { mouse: 6, touch: 12 };

/** The tile under a point in the Board's own pixels, or null off the Board. */
export function tileAtPoint(point: Point, tileSize: number): Tile | null {
  const tile = {
    column: Math.floor(point.x / tileSize),
    row: Math.floor(point.y / tileSize),
  };
  return isOnBoard(tile) ? tile : null;
}

/**
 * Turns raw pointer downs, moves and ups into taps, pans and pinches. Knows nothing of the
 * DOM, so the rules (a drag never places, a pinch never pans into a tap) are unit-tested.
 */
export class PointerGestures {
  private readonly down = new Map<number, Point>();
  private start: Point | null = null;
  /** Once a press moves past the slop or a second finger lands, it can't end as a tap. */
  private tapSpoiled = false;

  constructor(private readonly handlers: PointerHandlers) {}

  press(sample: PointerSample): void {
    this.down.set(sample.id, sample.point);
    if (this.down.size === 1) {
      this.start = sample.point;
      this.tapSpoiled = false;
    } else {
      this.tapSpoiled = true;
    }
  }

  move(sample: PointerSample): void {
    const previous = this.down.get(sample.id);
    if (previous === undefined) {
      if (sample.kind === "mouse") this.handlers.onHover(sample.point);
      return;
    }
    if (this.down.size >= 2) {
      this.pinch(sample);
      return;
    }
    this.down.set(sample.id, sample.point);
    if (
      this.start !== null &&
      distance(this.start, sample.point) > TAP_SLOP[sample.kind]
    ) {
      this.tapSpoiled = true;
    }
    if (this.tapSpoiled) {
      this.handlers.onPan(
        sample.point.x - previous.x,
        sample.point.y - previous.y,
      );
    }
  }

  release(sample: PointerSample): void {
    if (!this.down.delete(sample.id)) return;
    if (this.down.size === 0 && !this.tapSpoiled) {
      this.handlers.onTap(sample.point, sample.kind);
    }
  }

  /** The browser took the pointer away (a system gesture, the window lost focus). */
  cancel(sample: PointerSample): void {
    this.down.delete(sample.id);
    this.tapSpoiled = true;
  }

  leave(): void {
    if (this.down.size === 0) this.handlers.onHover(null);
  }

  private pinch(sample: PointerSample): void {
    const [first, second] = [...this.down.entries()];
    if (first === undefined || second === undefined) return;
    const before = [first[1], second[1]] as const;
    this.down.set(sample.id, sample.point);
    const after = [
      this.down.get(first[0]) ?? first[1],
      this.down.get(second[0]) ?? second[1],
    ] as const;
    const oldCentre = midpoint(before[0], before[1]);
    const newCentre = midpoint(after[0], after[1]);
    const oldSpread = distance(before[0], before[1]);
    if (oldSpread > 0) {
      this.handlers.onZoom(newCentre, distance(after[0], after[1]) / oldSpread);
    }
    this.handlers.onPan(newCentre.x - oldCentre.x, newCentre.y - oldCentre.y);
  }
}

/** One wheel notch zooms by this much; trackpads send smaller deltas and zoom smoothly. */
const WHEEL_ZOOM_PER_PIXEL = 0.0015;

/** Feeds DOM pointer and wheel events on `element` into the handlers. */
export function listenToPointer(
  element: HTMLElement,
  handlers: PointerHandlers,
): void {
  const gestures = new PointerGestures(handlers);
  const sampleOf = (event: PointerEvent): PointerSample => {
    const box = element.getBoundingClientRect();
    return {
      id: event.pointerId,
      kind: event.pointerType === "mouse" ? "mouse" : "touch",
      point: { x: event.clientX - box.left, y: event.clientY - box.top },
    };
  };
  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    element.setPointerCapture(event.pointerId);
    gestures.press(sampleOf(event));
  });
  element.addEventListener("pointermove", (event) => {
    gestures.move(sampleOf(event));
  });
  element.addEventListener("pointerup", (event) => {
    gestures.release(sampleOf(event));
  });
  element.addEventListener("pointercancel", (event) => {
    gestures.cancel(sampleOf(event));
  });
  element.addEventListener("pointerleave", () => {
    gestures.leave();
  });
  element.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      handlers.onZoom(
        { x: event.clientX - box.left, y: event.clientY - box.top },
        Math.exp(-wheelPixels(event) * WHEEL_ZOOM_PER_PIXEL),
      );
    },
    { passive: false },
  );
}

/** Firefox can report the wheel in lines; turn those into pixels so both zoom alike. */
const PIXELS_PER_LINE = 16;

function wheelPixels(event: WheelEvent): number {
  return event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * PIXELS_PER_LINE
    : event.deltaY;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
