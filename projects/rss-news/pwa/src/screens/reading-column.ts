// The centred column that Home, Briefings, an Item and Settings read in; it replaces what the
// page showed. An article for one piece of reading, a div for a screen of controls.
export function showInReadingColumn(
  root: HTMLElement,
  tag: "article" | "div",
  ...children: Node[]
): HTMLElement {
  const column = document.createElement(tag);
  column.className = "reading";
  column.append(...children);
  root.replaceChildren(column);
  return column;
}
