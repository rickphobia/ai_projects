/** The Screen is a fixed grid of characters; every frame fills all of it. */
export const SCREEN_COLUMNS = 120;
export const SCREEN_ROWS = 45;

/** Only printable ASCII (codes 32 to 126) may appear on the Screen. */
export const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
