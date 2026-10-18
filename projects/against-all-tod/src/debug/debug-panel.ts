import type { Side } from "../battle/battle";

/** How much gold one press of a give-gold button adds. */
export const DEBUG_GOLD = 100;

export interface DebugPanelActions {
  readonly onGiveGold: (side: Side, amount: number) => void;
  readonly onJumpToRound: (round: number) => void;
  readonly onToggleRoute: () => void;
}

/** The `?debug=1` buttons in a corner of the page. */
export function showDebugPanel(
  host: HTMLElement,
  actions: DebugPanelActions,
): void {
  const doc = host.ownerDocument;
  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const element = doc.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", onClick);
    return element;
  };
  const round = doc.createElement("input");
  round.type = "number";
  round.min = "1";
  round.value = "10";
  round.setAttribute("aria-label", "Round to jump to");
  host.replaceChildren(
    button(`+${String(DEBUG_GOLD)} Defense gold`, () => {
      actions.onGiveGold("defense", DEBUG_GOLD);
    }),
    button(`+${String(DEBUG_GOLD)} Attack gold`, () => {
      actions.onGiveGold("attack", DEBUG_GOLD);
    }),
    round,
    button("Jump to Round", () => {
      actions.onJumpToRound(Number(round.value));
    }),
    button("Route on/off", actions.onToggleRoute),
  );
  host.hidden = false;
}
