export interface ToggleGroup<Value extends string> {
  group: HTMLElement;
  value: () => Value;
}

// A row of buttons where exactly one is pressed, such as Latest | Importance. Pressing another
// one calls onChange with its value; pressing the pressed one does nothing.
export function toggleGroup<Value extends string>(
  label: string,
  choices: readonly (readonly [Value, string])[],
  initial: Value,
  onChange: (value: Value) => void,
): ToggleGroup<Value> {
  const group = document.createElement("div");
  group.className = "toggle-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  let current = initial;
  const buttons = choices.map(([value, text]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-pressed", String(value === initial));
    button.addEventListener("click", () => {
      if (value === current) return;
      current = value;
      for (const [index, other] of buttons.entries()) {
        other.setAttribute(
          "aria-pressed",
          String(choices[index]?.[0] === value),
        );
      }
      onChange(value);
    });
    return button;
  });
  group.append(...buttons);
  return { group, value: () => current };
}
