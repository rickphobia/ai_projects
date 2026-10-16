// Suggested questions on an empty home Chat: asked as soon as they are chosen, except one that
// needs a topic, which goes in the box for the owner to finish.
const SUGGESTIONS: readonly (readonly [string, "ask" | "finish"])[] = [
  ["What's interesting today?", "ask"],
  ["Summarise the last 24 hours", "ask"],
  ["Summarise the last 24 hours on ", "finish"],
];

export function suggestionChips(
  onAsk: (question: string) => void,
  onFinish: (start: string) => void,
): HTMLElement {
  const chips = document.createElement("div");
  chips.className = "chat-suggestions";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Suggested questions");
  for (const [text, action] of SUGGESTIONS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = action === "finish" ? `${text.trim()}…` : text;
    chip.addEventListener("click", () => {
      if (action === "ask") onAsk(text);
      else onFinish(text);
    });
    chips.append(chip);
  }
  return chips;
}
