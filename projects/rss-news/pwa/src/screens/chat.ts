import type { Chat, ChatMessage, ChatSummary } from "../api/chats";
import { RefusedError, SignedOutError, type ApiClient } from "../api/client";
import { relativeTime, shownTime } from "./shown-time";

export interface ChatPanelOptions {
  // A Source button opens its Item in the Item view.
  onOpenItem: (itemId: number) => void;
  // "Brief these" under an answer offers a Briefing of exactly its Items.
  onBriefThese: (itemIds: number[]) => void;
  // The Chat to show at first, such as the one open before the owner went to an Item.
  openChatId?: number | null;
  // Called with the Chat being shown whenever that changes, so it can be reopened.
  onChatOpened?: (chatId: number) => void;
}

// The Chat docked in the Inbox: a side panel on a wide screen, a bottom sheet opened from its
// Chat button on a phone (the stylesheet decides). The owner asks a question, sees each search
// as it runs, and gets the intro line and the matching Items, each with its one-line summary and
// a Source button, then "Brief these". Earlier Chats are listed, newest used first; choosing one
// shows its messages and continues it. A new Chat is only saved once something is asked.
export async function renderChatPanel(
  panel: HTMLElement,
  api: ApiClient,
  options: ChatPanelOptions,
): Promise<void> {
  const { onOpenItem, onBriefThese, onChatOpened, openChatId = null } = options;
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
  setOpen(openChatId !== null);
  toggle.addEventListener("click", () => {
    setOpen(panel.dataset.sheet !== "open");
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
  const messages = document.createElement("ol");
  messages.className = "chat-messages";
  messages.setAttribute("aria-label", "Messages");
  messages.setAttribute("aria-live", "polite");
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
  question.placeholder = "What happened in Malaysia?";
  const questionLabel = document.createElement("label");
  questionLabel.textContent = "Ask about your news";
  questionLabel.append(question);
  const ask = button("Ask");
  ask.type = "submit";
  form.append(questionLabel, ask);
  body.append(controls, history, messages, progress, failure, form);
  panel.className = "chat-panel";
  panel.setAttribute("aria-label", "Chat");
  panel.replaceChildren(toggle, body);

  let chat: Chat | null = null;
  // Each Chat shown gets a number; one that arrives after the owner chose another is dropped.
  let latestShown = 0;
  const messageRow = (message: ChatMessage): HTMLLIElement =>
    message.role === "owner"
      ? questionRow(message.text)
      : answerRow(message, onOpenItem, onBriefThese);

  const show = (shown: Chat | null): void => {
    chat = shown;
    messages.replaceChildren(...(shown?.messages ?? []).map(messageRow));
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
    try {
      const opened = await api.chat(chatId);
      if (thisShow === latestShown) show(opened);
    } catch (error) {
      if (thisShow !== latestShown || error instanceof SignedOutError) return;
      progress.textContent = "";
      showFailure(`Couldn't open the Chat: ${messageOf(error)}`);
    }
  }

  newChat.addEventListener("click", () => {
    latestShown += 1;
    show(null);
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
    question.value = "";
    ask.disabled = true;
    showFailure("");
    progress.textContent = "Searching your Items…";
    try {
      // A new Chat is created on its first question, so empty Chats aren't saved.
      const current = chat ?? (await api.createChat());
      if (thisShow !== latestShown) return;
      chat = current;
      onChatOpened?.(current.id);
      const answer = await api.askChat(current.id, text, (search) => {
        if (thisShow !== latestShown) return;
        progress.textContent = `Searched ${search.window}: ${itemCount(search.count)}.`;
      });
      if (thisShow !== latestShown) return;
      progress.textContent = "";
      messages.append(messageRow(answer));
      void listChats();
    } catch (error) {
      if (thisShow !== latestShown || error instanceof SignedOutError) return;
      // Nothing of a failed turn is saved, so the question goes back in the box to try again.
      asked.remove();
      question.value = text;
      progress.textContent = "";
      // A refusal is already worded for the owner; anything else needs saying what failed.
      showFailure(
        error instanceof RefusedError
          ? error.message
          : `The Chat couldn't answer: ${messageOf(error)}`,
      );
    } finally {
      ask.disabled = false;
    }
  }

  await Promise.all([
    listChats(),
    openChatId === null ? Promise.resolve() : choose(openChatId),
  ]);
}

function questionRow(text: string): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "chat-question";
  row.textContent = text;
  return row;
}

function answerRow(
  message: ChatMessage,
  onOpenItem: (itemId: number) => void,
  onBriefThese: (itemIds: number[]) => void,
): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "chat-answer";
  const intro = document.createElement("p");
  intro.textContent = message.text;
  row.append(intro);
  if (message.items.length === 0) return row;
  const items = document.createElement("ul");
  for (const item of message.items) {
    const source = button(item.source);
    source.className = "chat-source";
    source.setAttribute("aria-label", `${item.source}: ${item.title}`);
    source.title = item.title;
    source.addEventListener("click", () => {
      onOpenItem(item.id);
    });
    const entry = document.createElement("li");
    entry.append(item.summary ?? item.title, " ", source);
    items.append(entry);
  }
  const briefThese = button(`Brief these (${String(message.items.length)})`);
  briefThese.addEventListener("click", () => {
    onBriefThese(message.items.map((item) => item.id));
  });
  row.append(items, briefThese);
  return row;
}

function historyRow(
  summary: ChatSummary,
  onChoose: (chatId: number) => Promise<void>,
): HTMLLIElement {
  const choose = button(summary.title);
  choose.addEventListener("click", () => {
    void onChoose(summary.id);
  });
  const used = new Date(summary.updatedAt);
  const time = document.createElement("time");
  time.dateTime = summary.updatedAt;
  time.title = shownTime.format(used);
  time.textContent = relativeTime(used, new Date());
  const row = document.createElement("li");
  row.append(choose, time);
  return row;
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
