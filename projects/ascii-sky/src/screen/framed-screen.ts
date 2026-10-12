import { SCREEN_COLUMNS, SCREEN_ROWS } from "./screen-size";

/** One column of border and one of padding on each side. */
const TEXT_WIDTH = SCREEN_COLUMNS - 4;

/**
 * A full Screen with a border and the given text centred in it. Long lines are word-wrapped,
 * and anything outside printable ASCII becomes `?`, so any message (an error's, say) fits.
 */
export function framedScreen(text: readonly string[]): string[] {
  const body = text.flatMap((line) => wrap(toPrintable(line), TEXT_WIDTH));
  const shown = body.slice(0, SCREEN_ROWS - 2);
  const topPadding = Math.floor((SCREEN_ROWS - 2 - shown.length) / 2);
  const border = `+${"-".repeat(SCREEN_COLUMNS - 2)}+`;
  const inner: string[] = [];
  for (let row = 0; row < SCREEN_ROWS - 2; row++) {
    inner.push(framedLine(shown[row - topPadding] ?? ""));
  }
  return [border, ...inner, border];
}

function framedLine(text: string): string {
  const left = Math.floor((TEXT_WIDTH - text.length) / 2);
  return `| ${" ".repeat(left)}${text.padEnd(TEXT_WIDTH - left)} |`;
}

function toPrintable(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, "?");
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    for (const piece of chunks(word, width)) {
      if (current === "") current = piece;
      else if (current.length + 1 + piece.length <= width)
        current += ` ${piece}`;
      else {
        lines.push(current);
        current = piece;
      }
    }
  }
  lines.push(current);
  return lines;
}

/** Splits a word longer than the width into pieces that fit. */
function chunks(word: string, width: number): string[] {
  if (word.length <= width) return [word];
  const pieces: string[] = [];
  for (let start = 0; start < word.length; start += width) {
    pieces.push(word.slice(start, start + width));
  }
  return pieces;
}
