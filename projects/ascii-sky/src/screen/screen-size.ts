/** The Screen is a fixed grid of characters; every frame fills all of it. */
export const SCREEN_COLUMNS = 120;
export const SCREEN_ROWS = 45;

/** Only printable ASCII (codes 32 to 126) may appear on the Screen. */
export const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/** The Cockpit view fills the top rows of the Screen, full width; the Instrument panel sits below. */
export const VIEW_COLUMNS = SCREEN_COLUMNS;
export const VIEW_ROWS = 32;

/**
 * Width over height of one character cell, from index.html's font (a monospace glyph is about
 * 0.6em wide) and line-height (1.15em). The 3D view uses it so the World isn't squashed.
 */
export const CELL_ASPECT = 0.6 / 1.15;
