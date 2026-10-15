import type { InboxItem } from "../api/client";

export interface InboxContents {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  // Lists these Items, after the ones already listed when append is true.
  show: (items: InboxItem[], append: boolean) => void;
}

// The Inbox's Contents: a toolbar button and a panel sliding in from the side with one entry
// per loaded Item. Choosing an entry closes the panel and calls onChoose, which takes the
// owner to that Item's row; it does not open the Item.
export function inboxContents(
  onChoose: (itemId: number) => void,
): InboxContents {
  const panel = document.createElement("nav");
  panel.id = "inbox-contents";
  panel.className = "inbox-contents";
  panel.setAttribute("aria-labelledby", "inbox-contents-heading");
  const heading = document.createElement("h2");
  heading.id = "inbox-contents-heading";
  heading.textContent = "Contents";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "inbox-contents-close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close Contents");
  const header = document.createElement("div");
  header.className = "inbox-contents-header";
  header.append(heading, close);
  const entries = document.createElement("ol");
  const empty = document.createElement("p");
  empty.className = "inbox-contents-empty";
  empty.textContent = "No Items to list.";
  panel.append(header, entries, empty);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Contents";
  toggle.setAttribute("aria-controls", panel.id);

  const setOpen = (open: boolean): void => {
    panel.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  setOpen(false);

  toggle.addEventListener("click", () => {
    const opening = panel.dataset.open !== "true";
    setOpen(opening);
    if (opening) close.focus();
  });
  close.addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setOpen(false);
    toggle.focus();
  });

  const entry = (item: InboxItem): HTMLLIElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.title;
    if (!item.read) button.classList.add("unread");
    button.addEventListener("click", () => {
      setOpen(false);
      onChoose(item.id);
    });
    const listed = document.createElement("li");
    listed.append(button);
    return listed;
  };

  return {
    toggle,
    panel,
    show(items, append) {
      const listed = items.map(entry);
      if (append) entries.append(...listed);
      else entries.replaceChildren(...listed);
      empty.hidden = entries.childElementCount > 0;
    },
  };
}
