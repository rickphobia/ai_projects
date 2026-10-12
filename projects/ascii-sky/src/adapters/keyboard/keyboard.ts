import type { Action, Controls } from "../../game/controls";

/** `KeyboardEvent.code` values, so the player's keyboard layout doesn't move the keys. */
const KEY_ACTIONS: Readonly<Partial<Record<string, Action>>> = {
  ArrowUp: "pitchDown",
  ArrowDown: "pitchUp",
  ArrowLeft: "rollLeft",
  ArrowRight: "rollRight",
  KeyA: "rudderLeft",
  KeyD: "rudderRight",
  KeyW: "throttleUp",
  KeyS: "throttleDown",
  KeyF: "flapsStep",
  KeyB: "brakes",
  KeyP: "pause",
  Escape: "pause",
  KeyR: "restart",
};

export interface Keyboard {
  /** The actions held down now. Any key held counts as `start`. */
  controls(): Controls;
}

export function createKeyboard(target: Window): Keyboard {
  const held = new Set<string>();
  // A tap can go down and up between two frames; it still counts as held for one read.
  const tappedSinceRead = new Set<string>();
  target.addEventListener("keydown", (event) => {
    // Stops the arrows scrolling the page.
    if (KEY_ACTIONS[event.code] !== undefined) event.preventDefault();
    held.add(event.code);
    tappedSinceRead.add(event.code);
  });
  target.addEventListener("keyup", (event) => {
    held.delete(event.code);
  });
  // Keys released while the window is out of focus never send keyup.
  target.addEventListener("blur", () => {
    held.clear();
    tappedSinceRead.clear();
  });

  return {
    controls() {
      const down = new Set([...held, ...tappedSinceRead]);
      tappedSinceRead.clear();
      const actions = new Set<Action>();
      for (const code of down) {
        const action = KEY_ACTIONS[code];
        if (action !== undefined) actions.add(action);
      }
      if (down.size > 0) actions.add("start");
      return actions;
    },
  };
}

/** Phones and tablets have only a coarse pointer and no hover; they won't have a keyboard either. */
export function hasKeyboard(target: Window): boolean {
  return !target.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
