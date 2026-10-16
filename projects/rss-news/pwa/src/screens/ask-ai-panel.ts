import type { ChatQuote } from "../api/chats";
import type { ApiClient } from "../api/client";
import { renderChatPanel, type ChatPanelOptions } from "./chat";

export type AskAiPanelOptions = Pick<
  ChatPanelOptions,
  "onOpenItem" | "onBriefThese"
>;

// Ask AI from an Item: the Chat floats over the Item instead of leaving it for Home, as a side
// panel from 900px and a bottom sheet on a phone (the stylesheet decides). Asking again, from
// this Item or the next one, continues the same Chat with the new selection; Close hides it
// and the next Ask AI brings it back. The shell ends it once the owner leaves the Items.
export class AskAiPanel {
  readonly element = document.createElement("div");
  private readonly api: ApiClient;
  private readonly options: AskAiPanelOptions;
  private chatId: number | null = null;

  constructor(api: ApiClient, options: AskAiPanelOptions) {
    this.api = api;
    this.options = options;
    this.element.className = "ask-ai";
    this.element.hidden = true;
  }

  async open(quote: ChatQuote): Promise<void> {
    const panel = document.createElement("section");
    this.element.replaceChildren(panel);
    this.element.hidden = false;
    await renderChatPanel(panel, this.api, {
      ...this.options,
      layout: "panel",
      quote,
      openChatId: this.chatId,
      onChatOpened: (chatId) => {
        this.chatId = chatId;
      },
      onClose: () => {
        this.element.hidden = true;
      },
    });
  }

  // Leaving the Items: the next Ask AI starts a new Chat.
  end(): void {
    this.element.hidden = true;
    this.element.replaceChildren();
    this.chatId = null;
  }
}
