import type { ChatQuote } from "../api/chats";
import { SignedOutError, type ApiClient } from "../api/client";
import { LONGEST_CONTEXT, LONGEST_TERM } from "../api/dictionary";
import { LONGEST_COMMENT, LONGEST_ORIGIN, type NoteLink } from "../api/notes";

// The longest selection Ask AI sends; the server refuses more.
export const LONGEST_QUOTE = 4000;
// The selection settles before the popup shows: selectionchange fires on every step of a drag
// and of Android's selection handles.
export const SETTLE_MS = 300;

// Marks an element whose text can be selected for the popup, naming where it is from, such as
// "Item: Ringgit rises (Reuters)". Ask AI sends the name along with the selection; Note saves
// it with `link`, the Briefing, Item or Chat to go back to. Without a link, Note is off.
export function offerSelection(
  element: HTMLElement,
  origin: string,
  link?: NoteLink,
): void {
  element.dataset.selectionOrigin = origin;
  if (link) {
    element.dataset.noteKind = link.kind;
    element.dataset.noteId = String(link.id);
  } else {
    delete element.dataset.noteKind;
    delete element.dataset.noteId;
  }
}

// The selection popup: selecting text inside an element marked with offerSelection shows Ask
// AI, Note and Dictionary just below the selection (below, so Android's own selection menu above it
// stays usable). Ask AI hands the selection and its origin to onAskAi; Dictionary shows a short
// definition fitted to the paragraph around it. Note asks for an optional comment and saves
// the selection with a link back. It watches the document until `within` leaves
// it, so the shell installs it once.
export function installSelectionPopup(
  within: HTMLElement,
  api: ApiClient,
  onAskAi: (quote: ChatQuote) => void,
): void {
  const popup = document.createElement("div");
  popup.className = "selection-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Selection");
  popup.hidden = true;
  const askAi = button("Ask AI");
  const note = button("Note");
  const dictionary = button("Dictionary");
  const actions = document.createElement("div");
  actions.className = "toolbar";
  actions.append(askAi, note, dictionary);
  const noteForm = document.createElement("form");
  noteForm.className = "note-form";
  noteForm.hidden = true;
  const comment = document.createElement("textarea");
  comment.maxLength = LONGEST_COMMENT;
  comment.rows = 2;
  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comment (optional)";
  commentLabel.append(comment);
  const saveNote = button("Save Note");
  saveNote.type = "submit";
  noteForm.append(commentLabel, saveNote);
  const definition = document.createElement("p");
  definition.setAttribute("role", "status");
  definition.setAttribute("aria-label", "Definition");
  const noteStatus = document.createElement("p");
  noteStatus.setAttribute("role", "status");
  noteStatus.setAttribute("aria-label", "Note");
  popup.append(actions, noteForm, noteStatus, definition);
  within.append(popup);

  let selected: Omit<FoundSelection, "rect"> | null = null;
  // Each look-up gets a number; one answering after the selection changed is dropped.
  let lookUps = 0;
  let settling: ReturnType<typeof setTimeout> | undefined;
  // On a phone, tapping a popup button clears the selection before the click arrives, so
  // the popup stays while the last press was inside it.
  let pressedInPopup = false;

  const hide = (): void => {
    popup.hidden = true;
    selected = null;
    lookUps += 1;
  };

  const show = (): void => {
    const found = selectionIn(within);
    if (found === null) {
      // Typing a Note's comment moves the selection into the comment box.
      if (!pressedInPopup && !popup.contains(document.activeElement)) hide();
      return;
    }
    if (selected?.text === found.text && !popup.hidden) return;
    selected = found;
    lookUps += 1;
    definition.textContent = "";
    noteStatus.textContent = "";
    noteForm.hidden = true;
    comment.value = "";
    note.disabled = found.link === null;
    note.title = note.disabled ? "This text can't be saved as a Note." : "";
    dictionary.disabled = found.text.length > LONGEST_TERM;
    dictionary.title = dictionary.disabled
      ? "The Dictionary is for a word or a short phrase."
      : "";
    const below = found.rect.bottom + window.scrollY + 8;
    popup.style.top = `${String(below)}px`;
    popup.style.left = `${String(Math.max(found.rect.left + window.scrollX, 8))}px`;
    popup.hidden = false;
  };

  const onSelectionChange = (): void => {
    if (!within.isConnected) {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown);
      return;
    }
    clearTimeout(settling);
    settling = setTimeout(show, SETTLE_MS);
  };
  const onPointerDown = (event: PointerEvent): void => {
    pressedInPopup =
      event.target instanceof Node && popup.contains(event.target);
    if (!pressedInPopup && !popup.hidden) hide();
  };
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("pointerdown", onPointerDown);
  // Pressing a button would otherwise clear the selection before the click lands. The comment
  // box still takes the press, so it can be focused.
  popup.addEventListener("mousedown", (event) => {
    if (event.target !== comment) event.preventDefault();
  });
  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });

  askAi.addEventListener("click", () => {
    if (selected === null) return;
    const quote = { text: selected.text, origin: selected.origin };
    hide();
    window.getSelection()?.removeAllRanges();
    onAskAi(quote);
  });

  note.addEventListener("click", () => {
    if (selected === null) return;
    noteForm.hidden = false;
    noteStatus.textContent = "";
    comment.focus();
  });

  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (selected?.link == null) return;
    const saving = {
      text: selected.text,
      comment: comment.value.trim(),
      source: {
        ...selected.link,
        title: selected.origin.slice(0, LONGEST_ORIGIN),
      },
    };
    saveNote.disabled = true;
    noteStatus.textContent = "Saving…";
    api.saveNote(saving).then(
      () => {
        saveNote.disabled = false;
        noteForm.hidden = true;
        comment.value = "";
        noteStatus.textContent = "Saved to Notes.";
      },
      (error: unknown) => {
        saveNote.disabled = false;
        if (error instanceof SignedOutError) return;
        const detail = error instanceof Error ? error.message : String(error);
        noteStatus.textContent = `Couldn't save the Note: ${detail}`;
      },
    );
  });

  dictionary.addEventListener("click", () => {
    if (selected === null) return;
    const thisLookUp = ++lookUps;
    definition.textContent = "Looking it up…";
    api.defineWord(selected.text, selected.context).then(
      (found) => {
        if (thisLookUp !== lookUps) return;
        definition.textContent = `${found.term}: ${found.definition}`;
      },
      (error: unknown) => {
        if (thisLookUp !== lookUps || error instanceof SignedOutError) return;
        const detail = error instanceof Error ? error.message : String(error);
        definition.textContent = `Couldn't look it up: ${detail}`;
      },
    );
  });
}

interface FoundSelection {
  text: string;
  origin: string;
  // The paragraph or list entry around the selection, for the Dictionary.
  context: string;
  // The Briefing, Item or Chat a Note links back to; null where Note is off.
  link: NoteLink | null;
  rect: DOMRect;
}

function selectionIn(within: HTMLElement): FoundSelection | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  if (selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const start = elementOf(range.commonAncestorContainer);
  const offered = start?.closest<HTMLElement>("[data-selection-origin]");
  if (!offered || !within.contains(offered)) return null;
  const text = selection.toString().trim().slice(0, LONGEST_QUOTE);
  if (text === "") return null;
  const block = start?.closest("p, li, h2, h3, blockquote") ?? offered;
  const context = block.textContent
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LONGEST_CONTEXT);
  return {
    text,
    origin: offered.dataset.selectionOrigin ?? "",
    context,
    link: noteLinkOf(offered),
    rect: range.getBoundingClientRect(),
  };
}

function noteLinkOf(offered: HTMLElement): NoteLink | null {
  const { noteKind, noteId } = offered.dataset;
  if (
    (noteKind !== "briefing" && noteKind !== "item" && noteKind !== "chat") ||
    noteId === undefined
  ) {
    return null;
  }
  return { kind: noteKind, id: Number(noteId) };
}

function elementOf(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function button(text: string): HTMLButtonElement {
  const created = document.createElement("button");
  created.type = "button";
  created.textContent = text;
  return created;
}
