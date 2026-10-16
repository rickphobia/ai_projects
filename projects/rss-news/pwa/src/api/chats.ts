// Chats as the PWA sees them, and how the backend's JSON becomes them.

// An Item in a Chat answer; its title opens it in the Item view.
export interface ChatAnswerItem {
  id: number;
  title: string;
  source: string;
  // What the answer says about the Item, or null when it gave nothing.
  summary: string | null;
  // Null in answers saved before these were kept.
  importance: number | null;
  // ISO 8601 with a time zone.
  publishedAt: string | null;
}

export interface ChatAnswerItemJson {
  id: number;
  title: string;
  source: string;
  summary: string | null;
  importance?: number | null;
  published_at?: string | null;
}

export interface ChatMessage {
  id: number;
  // "owner" for a question, "assistant" for an answer.
  role: "owner" | "assistant";
  // ISO 8601 with a time zone.
  createdAt: string;
  // The question, or the answer's intro line.
  text: string;
  // An answer's Items; empty for a question.
  items: ChatAnswerItem[];
}

// Text the owner selected and chose Ask AI for, sent with their question.
export interface ChatQuote {
  text: string;
  // Where it was selected, such as "Item: Ringgit rises (Reuters)".
  origin: string;
}

// A saved Chat in the list, without its messages.
export interface ChatSummary {
  id: number;
  title: string;
  createdAt: string;
  // When it was last asked something; the list is newest used first.
  updatedAt: string;
  // USD to the cent, as text: "0.08".
  costUsd: string;
}

export interface Chat extends ChatSummary {
  messages: ChatMessage[];
}

// One search_items call the model made while answering, as it happens.
export interface ChatSearch {
  // Such as "the last 24 hours" or "since 2026-10-05".
  window: string;
  // How many Items matched.
  count: number;
}

export interface ChatSummaryJson {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  cost_usd: string;
}

export interface ChatMessageJson {
  id: number;
  role: "owner" | "assistant";
  created_at: string;
  text: string;
  items: ChatAnswerItemJson[];
}

export interface ChatJson extends ChatSummaryJson {
  messages: ChatMessageJson[];
}

export function chatSummaryFromJson(chat: ChatSummaryJson): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    costUsd: chat.cost_usd,
  };
}

export function chatFromJson(chat: ChatJson): Chat {
  return {
    ...chatSummaryFromJson(chat),
    messages: chat.messages.map(chatMessageFromJson),
  };
}

export function chatMessageFromJson(message: ChatMessageJson): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    createdAt: message.created_at,
    text: message.text,
    items: message.items.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      summary: item.summary,
      importance: item.importance ?? null,
      publishedAt: item.published_at ?? null,
    })),
  };
}

// One event of the answer's `text/event-stream` (POST api/chats/{id}/messages): `searched`
// for each search the model makes, then `message` with the saved answer, or `failed` with a
// detail for the owner. Null for an event the PWA doesn't know.
export type ChatAnswerEvent =
  | { kind: "searched"; search: ChatSearch }
  | { kind: "message"; message: ChatMessage }
  // `data` is FastAPI's {"detail": "..."}, read like any other refusal.
  | { kind: "failed"; data: unknown };

export function chatAnswerEvent(
  event: string,
  data: unknown,
): ChatAnswerEvent | null {
  if (event === "searched") {
    return { kind: "searched", search: data as ChatSearch };
  }
  if (event === "message") {
    return {
      kind: "message",
      message: chatMessageFromJson(data as ChatMessageJson),
    };
  }
  if (event === "failed") return { kind: "failed", data };
  return null;
}
