import type { Chat, ChatMessage, ChatQuote, ChatSearch } from "../api/chats";
import { RefusedError, SignedOutError, type ApiClient } from "../api/client";
import { storedPendingJobs, type PendingJobs } from "../pwa/pending-jobs";
import { answerRow, questionRow } from "./chat-answer";
import { historyRow } from "./chat-history";
import { suggestionChips } from "./chat-suggestions";

export interface ChatPanelOptions {
  // An answer's Item title opens it in the Item view, with the answer's Items as its list.
  onOpenItem: (itemId: number, listedIds?: number[]) => void;
  // "Brief these" under an answer offers a Briefing of exactly its Items.
  onBriefThese: (itemIds: number[]) => void;
  // The Chat to show at first, such as the one open before the owner went to an Item.
  openChatId?: number | null;
  // Called with the Chat being shown whenever that changes, so it can be reopened.
  onChatOpened?: (chatId: number) => void;
  // A selection the owner chose Ask AI for: the panel opens with it attached to the next
  // question.
  quote?: ChatQuote | null;
  // Start with the panel open even without a Chat or quote, as the Chat shortcut does.
  open?: boolean;
  // Given, the panel has a Close button that calls it, as Ask AI's panel over an Item does.
  onClose?: () => void;
  // "home" is the whole home screen: the question box up front with suggested questions under
  // it while the Chat is empty, and no sheet to open. "panel" (the default) is a side panel, a
  // bottom sheet on a phone.
  layout?: "panel" | "home";
  // Questions still being answered when the page was left; the browser's storage by default.
  pending?: PendingJobs;
}

// The Chat docked in the Inbox: a side panel on a wide screen, a bottom sheet opened from its
// Chat button on a phone (the stylesheet decides). The owner asks a question, sees each search
// as it runs, and gets the intro line and the matching Items, each with its one-line summary and
// a Source button, then "Brief these". Earlier Chats are listed, newest used first; choosing one
// shows its messages and continues it. A new Chat is only saved once something is asked. The
// server answers on when the page is left; coming back to the Chat shows the question as
// Answering… and then its answer.
// Given a quote (Ask AI), it opens with the quote shown above the question box, sent with the
// next question unless the owner removes it.
export async function renderChatPanel(
  panel: HTMLElement,
  api: ApiClient,
  options: ChatPanelOptions,
): Promise<void> {
  const {
    onOpenItem,
    onBriefThese,
    onChatOpened,
    onClose,
    openChatId = null,
    quote = null,
    open = false,
    layout = "panel",
    pending = storedPendingJobs(),
  } = options;
  const body = document.createElement("div");
  body.id = "chat-panel-body";
  body.className = "chat-body";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "chat-toggle";
  toggle.textContent = "Chat";
  toggle.setAttribute("aria-controls", body.id);
  const setOpen = (open: boolean): void => {
    panel.dataset.sheet = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", String(open));
  };
  setOpen(open || openChatId !== null || quote !== null);
  // Opening the sheet moves focus to the question box; Escape closes it again.
  toggle.addEventListener("click", () => {
    setOpen(panel.dataset.sheet !== "open");
    if (panel.dataset.sheet === "open") question.focus();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.dataset.sheet !== "open") return;
    setOpen(false);
    toggle.focus();
  });

  const newChat = button("New Chat");
  const history = document.createElement("details");
  history.className = "chat-history";
  const historySummary = document.createElement("summary");
  historySummary.textContent = "Earlier Chats";
  const historyList = document.createElement("ul");
  historyList.setAttribute("aria-label", "Earlier Chats");
  history.append(historySummary, historyList);
  const controls = document.createElement("div");
  controls.className = "toolbar";
  controls.append(newChat);
  if (onClose !== undefined) {
    const close = button("Close");
    close.addEventListener("click", onClose);
    controls.append(close);
  }
  const messages = document.createElement("ol");
  messages.className = "chat-messages";
  messages.setAttribute("aria-label", "Messages");
  const progress = document.createElement("p");
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-label", "Chat progress");
  const failure = document.createElement("p");
  failure.setAttribute("role", "alert");
  // Hidden while empty, so the Inbox's own alerts are the only ones on screen until it fails.
  const showFailure = (text: string): void => {
    failure.textContent = text;
    failure.hidden = text === "";
  };
  showFailure("");
  const form = document.createElement("form");
  form.className = "chat-form";
  const question = document.createElement("textarea");
  question.rows = 2;
  question.required = true;
  question.placeholder =
    layout === "home"
      ? "Ask anything about your news…"
      : "What happened in Malaysia?";
  // Enter asks, as in a chat app; Shift+Enter starts a new line.
  question.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
  const questionLabel = document.createElement("label");
  // Its own element, so Home can hide it from sight and keep it for screen readers.
  const labelText = document.createElement("span");
  labelText.className = "chat-label-text";
  labelText.textContent = "Ask about your news";
  questionLabel.append(labelText, question);
  const ask = button("Ask");
  ask.type = "submit";
  let attached = quote;
  const quoted = quoteBox(quote, () => {
    attached = null;
    quoted.remove();
    question.focus();
  });
  form.append(quoted, questionLabel, ask);
  const suggestions = suggestionChips(
    (text) => void askQuestion(text),
    (text) => {
      question.value = text;
      question.focus();
      question.setSelectionRange(text.length, text.length);
    },
  );
  const showSuggestions = (): void => {
    suggestions.hidden = layout !== "home" || messages.childElementCount > 0;
  };
  history
    .querySelector("summary")
    ?.replaceChildren(layout === "home" ? "Chat history" : "Earlier Chats");
  if (layout === "home") {
    body.append(
      messages,
      progress,
      failure,
      form,
      suggestions,
      controls,
      history,
    );
    panel.className = "chat-home";
    panel.replaceChildren(body);
  } else {
    body.append(controls, history, messages, progress, failure, form);
    panel.className = "chat-panel";
    panel.replaceChildren(toggle, body);
  }
  panel.setAttribute("aria-label", "Chat");
  showSuggestions();

  let chat: Chat | null = null;
  // Each Chat shown gets a number; one that arrives after the owner chose another is dropped.
  let latestShown = 0;
  const messageRow = (message: ChatMessage): HTMLLIElement =>
    message.role === "owner"
      ? questionRow(message.text)
      : answerRow(message, chat?.id ?? null, onOpenItem, onBriefThese);

  const show = (shown: Chat | null): void => {
    chat = shown;
    messages.replaceChildren(...(shown?.messages ?? []).map(messageRow));
    showSuggestions();
    progress.textContent = "";
    showFailure("");
    if (shown !== null) onChatOpened?.(shown.id);
  };

  const listChats = async (): Promise<void> => {
    try {
      const chats = await api.chats();
      historyList.replaceChildren(
        ...chats.map((summary) => historyRow(summary, choose)),
      );
      if (chats.length === 0) historyList.append(note("No Chats yet."));
    } catch (error) {
      if (error instanceof SignedOutError) return;
      historyList.replaceChildren(
        note(`Couldn't load the earlier Chats: ${messageOf(error)}`),
      );
    }
  };

  async function choose(chatId: number): Promise<void> {
    latestShown += 1;
    const thisShow = latestShown;
    history.open = false;
    progress.textContent = "Loading the Chat…";
    // A question asked now would go to a new Chat instead of continuing this one.
    ask.disabled = true;
    let opened: Chat | null = null;
    try {
      opened = await api.chat(chatId);
      if (thisShow === latestShown) show(opened);
    } catch (error) {
      if (thisShow !== latestShown || error instanceof SignedOutError) return;
      progress.textContent = "";
      showFailure(`Couldn't open the Chat: ${messageOf(error)}`);
    } finally {
      if (thisShow === latestShown) ask.disabled = false;
    }
    if (opened !== null && thisShow === latestShown) {
      void resumeAnswer(opened, thisShow);
    }
  }

  // A question the page was left on: the server answers on, so show it and follow its job.
  async function resumeAnswer(shown: Chat, thisShow: number): Promise<void> {
    const waiting = pending.answer(shown.id);
    if (waiting === null) return;
    const lastQuestion = shown.messages
      .filter((message) => message.role === "owner")
      .at(-1);
    // Answered and saved, and the server has since forgotten the job.
    if (lastQuestion?.text.startsWith(waiting.question)) {
      pending.setAnswer(shown.id, null);
      return;
    }
    const asked = questionRow(waiting.question);
    messages.append(asked);
    showSuggestions();
    ask.disabled = true;
    progress.textContent = "Answering…";
    try {
      const answer = await api.followChatAnswer(waiting.jobId, (search) => {
        if (thisShow === latestShown)
          progress.textContent = searchedText(search);
      });
      pending.setAnswer(shown.id, null);
      if (thisShow !== latestShown) return;
      progress.textContent = "";
      messages.append(messageRow(answer));
      void listChats();
    } catch (error) {
      if (error instanceof SignedOutError) return;
      // Failed, or lost to a server restart: either way it isn't running any more.
      if (error instanceof RefusedError) pending.setAnswer(shown.id, null);
      if (thisShow !== latestShown) return;
      asked.remove();
      showSuggestions();
      question.value = waiting.question;
      progress.textContent = "";
      showFailure(failureText(error));
    } finally {
      if (thisShow === latestShown) ask.disabled = false;
    }
  }

  newChat.addEventListener("click", () => {
    latestShown += 1;
    show(null);
    ask.disabled = false;
    question.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = question.value.trim();
    if (text === "") return;
    void askQuestion(text);
  });

  async function askQuestion(text: string): Promise<void> {
    latestShown += 1;
    const thisShow = latestShown;
    const asked = questionRow(text);
    messages.append(asked);
    showSuggestions();
    question.value = "";
    ask.disabled = true;
    showFailure("");
    progress.textContent = "Searching your Items…";
    let asking: number | null = null;
    try {
      // A new Chat is created on its first question, so New Chat alone saves nothing.
      const current = chat ?? (await api.createChat());
      if (thisShow !== latestShown) return;
      chat = current;
      onChatOpened?.(current.id);
      const sent = attached ?? undefined;
      asking = current.id;
      const answer = await api.askChat(
        current.id,
        text,
        (search) => {
          if (thisShow !== latestShown) return;
          progress.textContent = searchedText(search);
        },
        sent,
        // Remembered so coming back to this Chat shows it still being answered.
        (jobId) => {
          pending.setAnswer(current.id, { jobId, question: text });
        },
      );
      pending.setAnswer(current.id, null);
      if (thisShow !== latestShown) return;
      progress.textContent = "";
      // The quote went with this question; the next one is asked without it.
      if (sent !== undefined) {
        attached = null;
        quoted.remove();
      }
      messages.append(messageRow(answer));
      void listChats();
    } catch (error) {
      // Refused or failed on the server. A dropped connection leaves the job running, so it
      // stays remembered for coming back.
      if (asking !== null && error instanceof RefusedError) {
        pending.setAnswer(asking, null);
      }
      if (thisShow !== latestShown || error instanceof SignedOutError) return;
      // Nothing of a failed turn is saved, so the question goes back in the box to try again.
      asked.remove();
      showSuggestions();
      question.value = text;
      progress.textContent = "";
      showFailure(failureText(error));
    } finally {
      if (thisShow === latestShown) ask.disabled = false;
    }
  }

  // On Home, the Chat shortcut lands in the question box.
  if (quote !== null || (layout === "home" && open)) question.focus();
  await Promise.all([
    listChats(),
    openChatId === null ? Promise.resolve() : choose(openChatId),
  ]);
}

function quoteBox(quote: ChatQuote | null, onRemove: () => void): HTMLElement {
  const box = document.createElement("figure");
  box.className = "chat-quote";
  box.hidden = quote === null;
  if (quote === null) return box;
  box.setAttribute("aria-label", "Asking about");
  const text = document.createElement("blockquote");
  text.textContent = quote.text;
  const origin = document.createElement("figcaption");
  origin.textContent = `From ${quote.origin}`;
  const remove = button("Remove");
  remove.setAttribute("aria-label", "Remove the quote");
  remove.addEventListener("click", onRemove);
  origin.append(" ", remove);
  box.append(text, origin);
  return box;
}

function searchedText(search: ChatSearch): string {
  return `Searched ${search.window}: ${itemCount(search.count)}.`;
}

// A refusal is already worded for the owner; anything else needs saying what failed.
function failureText(error: unknown): string {
  return error instanceof RefusedError
    ? error.message
    : `The Chat couldn't answer: ${messageOf(error)}`;
}

function itemCount(count: number): string {
  return count === 1 ? "1 Item" : `${String(count)} Items`;
}

function note(text: string): HTMLLIElement {
  const row = document.createElement("li");
  row.textContent = text;
  return row;
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
