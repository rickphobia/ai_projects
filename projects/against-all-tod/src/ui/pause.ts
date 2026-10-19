/** "50%" for an actual volume of 0.5. */
export function volumeLabel(volume: number): string {
  return `${String(Math.round(volume * 100))}%`;
}

export interface PauseHandlers {
  readonly onPausedChange: (paused: boolean) => void;
  readonly onActualVolume: (volume: number) => void;
}

/**
 * The pause menu: a button that stops the battle and opens the honest "Actual volume (we
 * promise)" slider, which sets real sound and never touches the game's tricks.
 */
export function showPauseMenu(
  host: HTMLElement,
  actualVolume: number,
  handlers: PauseHandlers,
): void {
  const doc = host.ownerDocument;
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = "pause-toggle";
  toggle.textContent = "Pause";
  toggle.setAttribute("aria-expanded", "false");

  const panel = doc.createElement("div");
  panel.className = "pause-panel";
  panel.hidden = true;
  const heading = doc.createElement("h2");
  heading.textContent = "Paused";
  const label = doc.createElement("label");
  const name = doc.createElement("span");
  name.textContent = `Actual volume (we promise) ${volumeLabel(actualVolume)}`;
  const input = doc.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "5";
  input.value = String(Math.round(actualVolume * 100));
  input.addEventListener("input", () => {
    const volume = Number(input.value) / 100;
    name.textContent = `Actual volume (we promise) ${volumeLabel(volume)}`;
    handlers.onActualVolume(volume);
  });
  label.append(name, input);
  panel.append(heading, label);

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    const paused = !panel.hidden;
    toggle.textContent = paused ? "Resume" : "Pause";
    toggle.setAttribute("aria-expanded", String(paused));
    handlers.onPausedChange(paused);
  });
  // The panel opens upward from the button in the bottom corner.
  host.replaceChildren(panel, toggle);
}
