import type { Logger } from "../logger";

/** The button's label: what a tap does next. */
export function fullScreenLabel(active: boolean): string {
  return active ? "⛶ Exit full screen" : "⛶ Full screen";
}

/** `screen.orientation.lock` is missing from TypeScript's DOM types and from most browsers. */
interface LockableOrientation {
  lock?: (orientation: "landscape") => Promise<void>;
}

/**
 * A button that fills the whole screen with the game, hiding the browser's own bars, which
 * on a phone held sideways take a third of the height. Where the browser can lock the
 * rotation (Android Chrome), the game also stays in landscape. Shows nothing where full
 * screen isn't offered (Safari on an iPhone).
 */
export function showFullScreenButton(host: HTMLElement, logger: Logger): void {
  const doc = host.ownerDocument;
  if (!doc.fullscreenEnabled) {
    logger.debug("full screen not offered by this browser");
    return;
  }
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "btn full-screen-toggle";
  const label = (): void => {
    const active = doc.fullscreenElement !== null;
    button.textContent = fullScreenLabel(active);
    button.setAttribute("aria-pressed", String(active));
  };
  label();
  doc.addEventListener("fullscreenchange", label);
  button.addEventListener("click", () => {
    if (doc.fullscreenElement !== null) {
      doc.exitFullscreen().catch((error: unknown) => {
        logger.warn("leaving full screen failed", { error: String(error) });
      });
      return;
    }
    doc.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .then(() => lockLandscape(doc, logger))
      .catch((error: unknown) => {
        logger.warn("entering full screen failed", { error: String(error) });
      });
  });
  host.replaceChildren(button);
}

/** Best effort: most browsers refuse, and the game is playable either way. */
async function lockLandscape(doc: Document, logger: Logger): Promise<void> {
  const orientation = doc.defaultView?.screen.orientation as
    LockableOrientation | undefined;
  if (orientation?.lock === undefined) return;
  try {
    await orientation.lock("landscape");
  } catch (error: unknown) {
    logger.debug("landscape lock refused", { error: String(error) });
  }
}
