import { fitToView, type Size } from "./fit-to-view";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where the Board sits on screen: screen = board pixel × scale + (x, y). */
export interface Camera {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface CameraBounds {
  readonly view: Size;
  readonly content: Size;
  /** Screen pixels kept free around the Board when it is smaller than the view. */
  readonly margin: number;
  /** The most a Board pixel may be magnified, if the fitted scale is not already bigger. */
  readonly maxScale: number;
}

/** The camera that shows the whole Board; also the furthest the player can zoom out. */
export function fittedCamera(bounds: CameraBounds): Camera {
  return fitToView(bounds.view, bounds.content, bounds.margin);
}

/** The Board pixel under a screen point. */
export function screenToBoard(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.x) / camera.scale,
    y: (point.y - camera.y) / camera.scale,
  };
}

/** Zooms by `factor`, keeping the Board pixel under `anchor` where it is on screen. */
export function zoomAt(
  camera: Camera,
  anchor: Point,
  factor: number,
  bounds: CameraBounds,
): Camera {
  const scale = clampScale(camera.scale * factor, bounds);
  const boardPoint = screenToBoard(anchor, camera);
  return clampCamera(
    {
      scale,
      x: anchor.x - boardPoint.x * scale,
      y: anchor.y - boardPoint.y * scale,
    },
    bounds,
  );
}

export function panBy(
  camera: Camera,
  dx: number,
  dy: number,
  bounds: CameraBounds,
): Camera {
  return clampCamera(
    { scale: camera.scale, x: camera.x + dx, y: camera.y + dy },
    bounds,
  );
}

/**
 * Keeps the Board findable: never smaller than fits the view, never bigger than `maxScale`.
 * A Board narrower than the view is centred; a wider one can't pull its edge past the margin.
 */
export function clampCamera(camera: Camera, bounds: CameraBounds): Camera {
  const scale = clampScale(camera.scale, bounds);
  return {
    scale,
    x: clampAxis(
      camera.x,
      bounds.view.width,
      bounds.content.width * scale,
      bounds.margin,
    ),
    y: clampAxis(
      camera.y,
      bounds.view.height,
      bounds.content.height * scale,
      bounds.margin,
    ),
  };
}

function clampScale(scale: number, bounds: CameraBounds): number {
  const min = fittedCamera(bounds).scale;
  return Math.min(Math.max(scale, min), Math.max(min, bounds.maxScale));
}

function clampAxis(
  offset: number,
  view: number,
  content: number,
  margin: number,
): number {
  if (content <= view - 2 * margin) return (view - content) / 2;
  return Math.min(margin, Math.max(view - margin - content, offset));
}
