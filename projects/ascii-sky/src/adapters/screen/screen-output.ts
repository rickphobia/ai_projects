import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from "../../screen/screen-size";

/** Something tried to show text that isn't a full Screen; a bug in whatever drew it. */
export class ScreenError extends Error {
  override name = "ScreenError";
}

export interface ScreenOutput {
  /** Replaces the whole Screen. Throws ScreenError unless given 45 lines of 120 printable characters. */
  show(lines: readonly string[]): void;
}

/**
 * Writes the Screen into one `<pre>` and scales it to fit the window. The text is laid out
 * at its natural size and then shrunk or grown with a CSS transform, so the browser never
 * wraps or stretches it, whatever the font's character width turns out to be.
 */
export function createScreenOutput(
  pre: HTMLPreElement,
  view: Window,
): ScreenOutput {
  const fit = (): void => {
    const scale = Math.min(
      view.innerWidth / pre.offsetWidth,
      view.innerHeight / pre.offsetHeight,
    );
    pre.style.transform = `scale(${String(scale)})`;
  };
  view.addEventListener("resize", fit);

  return {
    show(lines) {
      checkScreen(lines);
      const text = lines.join("\n");
      if (pre.textContent === text) return;
      const firstShow = pre.textContent === "";
      pre.textContent = text;
      if (firstShow) fit();
    },
  };
}

function checkScreen(lines: readonly string[]): void {
  if (lines.length !== SCREEN_ROWS) {
    throw new ScreenError(
      `expected ${String(SCREEN_ROWS)} lines, got ${String(lines.length)}`,
    );
  }
  lines.forEach((line, row) => {
    if (line.length !== SCREEN_COLUMNS || !PRINTABLE_ASCII.test(line)) {
      throw new ScreenError(
        `line ${String(row)} must be ${String(SCREEN_COLUMNS)} printable ASCII characters, got ${JSON.stringify(line)}`,
      );
    }
  });
}
