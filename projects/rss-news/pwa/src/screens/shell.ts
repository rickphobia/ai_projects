import { SignedOutError, type ApiClient } from "../api/client";
import { renderBriefings } from "./briefings";
import { renderHome } from "./home";
import { renderInbox } from "./inbox";
import { renderItem } from "./item";
import { renderSources } from "./sources";

// The app shell for a signed-in owner: the name, whether the backend is up, sign out, and
// the home screen (the latest Briefing), the Inbox, an Item, the saved Briefings or the
// Sources screen below.
export async function renderShell(
  root: HTMLElement,
  api: ApiClient,
  onSignedOut: () => void,
): Promise<void> {
  const heading = document.createElement("h1");
  heading.textContent = "rss-news";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Server");
  status.textContent = "Checking the server…";
  const signOut = document.createElement("button");
  signOut.type = "button";
  signOut.textContent = "Sign out";
  signOut.addEventListener("click", () => {
    api.logout().then(onSignedOut, (error: unknown) => {
      // A 401 already sent the owner to login.
      if (error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      status.textContent = `Couldn't sign out: ${detail}`;
    });
  });
  const page = document.createElement("section");
  const toHome = navButton("Home");
  const toInbox = navButton("Inbox");
  const toBriefings = navButton("Briefings");
  const toSources = navButton("Sources");
  const nav = document.createElement("nav");
  nav.append(toHome, toInbox, toBriefings, toSources);
  const showHome = (pickedItemIds?: number[]): Promise<void> =>
    renderHome(
      page,
      api,
      (itemId) => {
        void renderItem(
          page,
          api,
          itemId,
          () => void showHome(),
          "Back to Home",
        );
      },
      pickedItemIds,
    );
  const showInbox = (): Promise<void> =>
    renderInbox(
      page,
      api,
      (itemId) => {
        void renderItem(page, api, itemId, () => void showInbox());
      },
      (itemIds) => void showHome(itemIds),
    );
  const showBriefings = (): Promise<void> =>
    renderBriefings(page, api, (itemId) => {
      void renderItem(
        page,
        api,
        itemId,
        () => void showBriefings(),
        "Back to Briefings",
      );
    });
  toHome.addEventListener("click", () => {
    void showHome();
  });
  toInbox.addEventListener("click", () => {
    void showInbox();
  });
  toBriefings.addEventListener("click", () => {
    void showBriefings();
  });
  toSources.addEventListener("click", () => {
    void renderSources(page, api);
  });
  root.replaceChildren(heading, status, signOut, nav, page);

  await Promise.all([showHealth(api, status), showHome()]);
}

async function showHealth(api: ApiClient, status: HTMLElement): Promise<void> {
  try {
    const health = await api.health();
    status.textContent =
      health.status === "ok"
        ? "The server is up."
        : "The server is up, but its database is unreachable.";
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    status.textContent = `Can't reach the server: ${detail}`;
  }
}

function navButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  return button;
}
