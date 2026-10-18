export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Fit {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** Below this the Board is a speck anyway; it keeps the scale positive in a collapsed window. */
const MIN_SCALE = 0.01;

/**
 * The scale and offset that show all of `content` centred in `view`, keeping its shape and
 * leaving `margin` pixels free on every side. The camera starts here and never zooms out past it.
 */
export function fitToView(view: Size, content: Size, margin: number): Fit {
  const scale = Math.max(
    MIN_SCALE,
    Math.min(
      (view.width - 2 * margin) / content.width,
      (view.height - 2 * margin) / content.height,
    ),
  );
  return {
    scale,
    x: (view.width - content.width * scale) / 2,
    y: (view.height - content.height * scale) / 2,
  };
}
