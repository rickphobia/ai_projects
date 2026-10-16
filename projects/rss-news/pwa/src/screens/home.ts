import type { ApiClient } from "../api/client";
import { renderChatPanel, type ChatPanelOptions } from "./chat";

export type HomeChat = Omit<ChatPanelOptions, "layout">;

// The home screen is the Chat, like oksskolten's: a greeting, one big question box with
// suggested questions under it, the answers above the box as they come, and the Chat history.
// Brief me and the latest Briefing live at the top of the Inbox.
export async function renderHome(
  root: HTMLElement,
  api: ApiClient,
  chat: HomeChat,
  now: Date = new Date(),
): Promise<void> {
  const greeting = document.createElement("h2");
  greeting.className = "home-greeting";
  greeting.textContent = greetingFor(now);
  const panel = document.createElement("section");
  const home = document.createElement("div");
  home.className = "home";
  home.append(greeting, panel);
  root.replaceChildren(home);
  await renderChatPanel(panel, api, { ...chat, layout: "home" });
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
