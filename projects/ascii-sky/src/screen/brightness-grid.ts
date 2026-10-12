/**
 * How bright each character cell of the Cockpit view is, from 0 (black) to 1 (white).
 * Row-major, top row first, `columns * rows` values.
 */
export interface BrightnessGrid {
  readonly columns: number;
  readonly rows: number;
  readonly values: ArrayLike<number>;
}
