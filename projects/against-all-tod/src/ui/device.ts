/**
 * A phone or tablet held upright: the Board is wide, so it is only played in landscape.
 * `pointer: coarse` keeps a narrow desktop window from being told to turn.
 */
export const PORTRAIT_TOUCH_QUERY =
  "(orientation: portrait) and (pointer: coarse)";

/** Shows the turn-your-device screen while `query` matches and hides it once it doesn't. */
export function showTurnDeviceScreenWhile(
  screen: HTMLElement,
  query: MediaQueryList,
): void {
  const update = (): void => {
    screen.hidden = !query.matches;
  };
  update();
  query.addEventListener("change", update);
}
