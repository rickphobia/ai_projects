import type { GameState } from "../game/game";
import type { BrightnessGrid } from "./brightness-grid";
import { drawCockpitScreen } from "./cockpit-screen";
import { framedScreen } from "./framed-screen";
import { drawInstrumentPanel } from "./instrument-panel";
import { SCREEN_COLUMNS, VIEW_ROWS } from "./screen-size";

const TITLE_ART = [
  "   _    ___   ___  ___  ___     ___  _  __ __   __",
  "  /_\\  / __| / __||_ _||_ _|   / __|| |/ / \\ \\ / /",
  " / _ \\ \\__ \\| (__  | |  | |    \\__ \\| ' <   \\ V / ",
  "/_/ \\_\\|___/ \\___||___||___|   |___/|_|\\_\\   |_|  ",
];

const KEYS: readonly (readonly [string, string])[] = [
  ["Up / Down arrows", "nose down / nose up"],
  ["Left / Right arrows", "roll left / right"],
  ["A / D", "rudder left / right"],
  ["W / S", "throttle up / down"],
  ["F", "flaps (next setting)"],
  ["B", "brakes"],
  ["P / Esc", "pause"],
  ["R", "restart"],
];

/** Draw: the whole Screen for this game state, with the Cockpit view coming from the brightness grid. */
export function drawGame(state: GameState, view: BrightnessGrid): string[] {
  switch (state.phase) {
    case "title":
      return titleScreen();
    case "flying":
      return drawCockpitScreen(
        view,
        drawInstrumentPanel(state.plane, state.world),
      );
    case "paused":
      return withBanner(
        drawCockpitScreen(view, drawInstrumentPanel(state.plane, state.world)),
        ["PAUSED", "", "Press P or Esc to carry on"],
      );
  }
}

function titleScreen(): string[] {
  const keyWidth = Math.max(...KEYS.map(([key]) => key.length));
  const keyLines = KEYS.map(
    ([key, action]) => `${key.padEnd(keyWidth)}   ${action}`,
  );
  // framedScreen centres each line on its own and drops leading spaces, so each block gets
  // one width, and the art a box so its lines don't start with a space.
  const art = sameWidth(TITLE_ART);
  const artBorder = `+${"-".repeat((art[0]?.length ?? 0) + 4)}+`;
  return framedScreen([
    artBorder,
    ...art.map((line) => `|  ${line}  |`),
    artBorder,
    "",
    "A flight simulator in ASCII",
    "",
    "",
    ...sameWidth(keyLines),
    "",
    "",
    "Press any key to start",
  ]);
}

function sameWidth(lines: readonly string[]): string[] {
  const width = Math.max(...lines.map((line) => line.length));
  return lines.map((line) => line.padEnd(width));
}

/** A boxed message drawn over the middle of the Cockpit view. */
function withBanner(screen: string[], text: readonly string[]): string[] {
  const inner = Math.max(...text.map((line) => line.length)) + 4;
  const border = `+${"-".repeat(inner)}+`;
  const box = [
    border,
    ...text.map((line) => {
      const left = Math.floor((inner - line.length) / 2);
      return `|${" ".repeat(left)}${line.padEnd(inner - left)}|`;
    }),
    border,
  ];
  const top = Math.floor((VIEW_ROWS - box.length) / 2);
  const left = Math.floor((SCREEN_COLUMNS - border.length) / 2);
  return screen.map((line, row) => {
    const boxLine = box[row - top];
    if (boxLine === undefined) return line;
    return line.slice(0, left) + boxLine + line.slice(left + boxLine.length);
  });
}
