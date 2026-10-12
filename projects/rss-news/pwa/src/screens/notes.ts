import { SignedOutError, type ApiClient } from "../api/client";
import { LONGEST_COMMENT, type Note, type NoteLink } from "../api/notes";
import { showBriefing } from "./briefing-view";
import { showInReadingColumn } from "./reading-column";
import { shownTime } from "./shown-time";

const KIND_NAMES = { briefing: "Briefing", item: "Item", chat: "Chat" };

// The Notes screen: every Note newest first, each with its saved text, its comment (which the
// owner can change), a link back to where it came from and a Delete button. A Note whose
// Briefing, Item or Chat is gone keeps its text and says so instead of linking. Export saves
// every Note as a Markdown file.
export async function renderNotes(
  root: HTMLElement,
  api: ApiClient,
  onOpenSource: (link: NoteLink) => void,
): Promise<void> {
  const heading = document.createElement("h2");
  heading.textContent = "Notes";
  const exportButton = button("Export as Markdown");
  const list = document.createElement("ul");
  list.setAttribute("aria-label", "Notes");
  list.className = "rows notes";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Notes status");
  showInReadingColumn(root, "div", heading, exportButton, status, list);

  const showEmpty = (): void => {
    if (list.children.length === 0) {
      status.textContent =
        "No Notes yet. Select text in a Briefing, an Item or a Chat answer and choose Note.";
    }
  };
  const failed = (doing: string, error: unknown): void => {
    if (error instanceof SignedOutError) return;
    status.textContent = `Couldn't ${doing}: ${messageOf(error)}`;
  };

  exportButton.addEventListener("click", () => {
    api.exportNotes().then(saveMarkdown, (error: unknown) => {
      failed("export the Notes", error);
    });
  });

  let notes: Note[];
  try {
    notes = await api.notes();
  } catch (error) {
    failed("load the Notes", error);
    return;
  }
  list.replaceChildren(
    ...notes.map((note) =>
      noteRow(note, api, onOpenSource, {
        onDeleted: (row) => {
          row.remove();
          status.textContent = "Note deleted.";
          showEmpty();
        },
        onFailed: failed,
      }),
    ),
  );
  showEmpty();
}

// A Note's Briefing, opened from the Notes screen with a button back to it.
export async function renderNoteBriefing(
  root: HTMLElement,
  api: ApiClient,
  briefingId: number,
  onOpenItem: (itemId: number) => void,
  onBack: () => void,
): Promise<void> {
  const back = button("Back to Notes");
  back.addEventListener("click", onBack);
  const shown = document.createElement("section");
  shown.setAttribute("aria-label", "Briefing");
  shown.className = "briefing";
  shown.textContent = "Loading the Briefing…";
  showInReadingColumn(root, "article", back, shown);
  try {
    showBriefing(shown, await api.briefing(briefingId), onOpenItem);
  } catch (error) {
    if (error instanceof SignedOutError) return;
    shown.textContent = `Couldn't load the Briefing: ${messageOf(error)}`;
  }
}

interface RowEvents {
  onDeleted: (row: HTMLLIElement) => void;
  onFailed: (doing: string, error: unknown) => void;
}

function noteRow(
  note: Note,
  api: ApiClient,
  onOpenSource: (link: NoteLink) => void,
  { onDeleted, onFailed }: RowEvents,
): HTMLLIElement {
  const row = document.createElement("li");
  row.setAttribute("aria-label", `Note: ${note.text.slice(0, 60)}`);
  const quote = document.createElement("blockquote");
  quote.textContent = note.text;
  const comment = document.createElement("textarea");
  comment.maxLength = LONGEST_COMMENT;
  comment.rows = 2;
  comment.value = note.comment;
  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comment";
  commentLabel.append(comment);
  const saveComment = button("Save comment");
  saveComment.addEventListener("click", () => {
    saveComment.disabled = true;
    api.changeNoteComment(note.id, comment.value.trim()).then(
      (changed) => {
        saveComment.disabled = false;
        comment.value = changed.comment;
      },
      (error: unknown) => {
        saveComment.disabled = false;
        onFailed("save the comment", error);
      },
    );
  });
  const remove = button("Delete");
  remove.addEventListener("click", () => {
    api.deleteNote(note.id).then(
      () => {
        onDeleted(row);
      },
      (error: unknown) => {
        onFailed("delete the Note", error);
      },
    );
  });
  const details = document.createElement("small");
  details.textContent = `Saved ${shownTime.format(new Date(note.createdAt))} · `;
  details.append(sourceLink(note, onOpenSource));
  row.append(quote, details, commentLabel, saveComment, remove);
  return row;
}

function sourceLink(
  note: Note,
  onOpenSource: (link: NoteLink) => void,
): HTMLElement {
  const { source } = note;
  if (!source.exists) {
    const gone = document.createElement("span");
    gone.textContent = `${source.title} (this ${KIND_NAMES[source.kind]} is gone)`;
    return gone;
  }
  const link = document.createElement("a");
  link.href = `#${source.kind}s/${String(source.id)}`;
  link.textContent = source.title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenSource({ kind: source.kind, id: source.id });
  });
  return link;
}

function saveMarkdown(markdown: string): void {
  const url = URL.createObjectURL(
    new Blob([markdown], { type: "text/markdown" }),
  );
  const download = document.createElement("a");
  download.href = url;
  download.download = "notes.md";
  download.click();
  URL.revokeObjectURL(url);
}

function button(text: string): HTMLButtonElement {
  const created = document.createElement("button");
  created.type = "button";
  created.textContent = text;
  return created;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
