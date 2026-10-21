/** Five-row block letters, only the ones the ending banners need. */
const LETTERS: Readonly<Record<string, readonly string[]>> = {
  A: [" ### ", "#   #", "#####", "#   #", "#   #"],
  C: [" ####", "#    ", "#    ", "#    ", " ####"],
  D: ["#### ", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#### ", "#    ", "#####"],
  F: ["#####", "#    ", "#### ", "#    ", "#    "],
  H: ["#   #", "#   #", "#####", "#   #", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#####"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", " ### "],
  R: ["#### ", "#   #", "#### ", "#  # ", "#   #"],
  S: [" ####", "#    ", " ### ", "    #", "#### "],
  U: ["#   #", "#   #", "#   #", "#   #", " ### "],
  W: ["#   #", "#   #", "# # #", "## ##", "#   #"],
  Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
  "-": ["     ", "     ", "#####", "     ", "     "],
  " ": ["   ", "   ", "   ", "   ", "   "],
};

const ROWS = 5;

/** `text` in block letters, one string per row, all the same width. Unknown characters become blanks. */
export function blockLetters(text: string): string[] {
  const glyphs = Array.from(text.toUpperCase(), (character) => character).map(
    (character) => LETTERS[character] ?? LETTERS[" "] ?? [],
  );
  const rows: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    rows.push(glyphs.map((glyph) => glyph[row] ?? "").join(" "));
  }
  return rows;
}
