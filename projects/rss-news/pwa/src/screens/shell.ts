import type { ChatQuote } from "../api/chats";
import { SignedOutError, type ApiClient } from "../api/client";
import { noDevicePush, type DevicePush } from "../pwa/device-push";
import type { Shortcut } from "../pwa/shortcut";
import { renderBriefings } from "./briefings";
import { renderHome } from "./home";
import { renderInbox } from "./inbox";
import { renderItem } from "./item";
import { renderNoteBriefing, renderNotes } from "./notes";
import { installSelectionPopup } from "./selection";
import { renderSettings, spendingBanner } from "./settings";
import { renderSources } from "./sources";
import { renderStocks } from "./stocks";

export interface ShellOptions {
  // This browser's push subscription, for the Alerts opt-in in Settings.
  devicePush?: DevicePush;
  // Open this Item instead of the home screen, as tapping an Alert does.
  openItemId?: number | null;
  // Open the screen an app icon shortcut names instead of the home screen.
  shortcut?: Shortcut | null;
}

// The app shell for a signed-in owner: a header with the name and whether the backend is up,
// a sidebar with the screens and the Folders (a drawer opened from the header's Menu button on
// a phone), a spending warning from 80% of the monthly limit, and the page: the home screen
// (the latest Briefing), the Inbox (all of it or one Folder), an Item, the saved Briefings,
// the Notes, the Sources, the Stocks or the Settings screen.
export async function renderShell(
  root: HTMLElement,
  api: ApiClient,
  onSignedOut: () => void,
  {
    devicePush = noDevicePush,
    openItemId = null,
    shortcut = null,
  }: ShellOptions = {},
): Promise<void> {
  const heading = document.createElement("h1");
  heading.textContent = "rss-news";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Server");
  status.textContent = "Checking the server…";
  const signOut = navButton("Sign out");
  signOut.classList.add("sign-out");
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
  const toNotes = navButton("Notes");
  const toSources = navButton("Sources");
  const toStocks = navButton("Stocks");
  const toSettings = navButton("Settings");
  const folderHeading = document.createElement("p");
  folderHeading.className = "sidebar-heading";
  folderHeading.textContent = "Folders";
  const folderList = document.createElement("ul");
  folderList.setAttribute("aria-label", "Folders");
  const sidebar = document.createElement("nav");
  sidebar.id = "sidebar";
  sidebar.className = "sidebar";
  sidebar.append(
    toHome,
    toInbox,
    toBriefings,
    toNotes,
    toSources,
    toStocks,
    toSettings,
    folderHeading,
    folderList,
    signOut,
  );
  const warning = document.createElement("div");
  const main = document.createElement("main");
  main.className = "page";
  main.append(warning, page);
  // The shell's own element, so the login screen that replaces it inherits none of its layout.
  const app = document.createElement("div");
  app.className = "app";
  const drawer = drawerControls(app, sidebar, main);
  const header = document.createElement("header");
  header.className = "app-header";
  header.append(drawer.menuButton, heading, status);

  // Marks the screen being shown in the sidebar and closes the drawer.
  const showing = (current: HTMLButtonElement): void => {
    for (const entry of sidebar.querySelectorAll("button")) {
      entry.removeAttribute("aria-current");
    }
    current.setAttribute("aria-current", "page");
    drawer.close();
  };
  const showHome = (
    pickedItemIds?: number[],
    briefNow = false,
  ): Promise<void> => {
    showing(toHome);
    return renderHome(
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
      briefNow,
    );
  };
  // The Chat open in the Inbox, so it is still there after going to an Item and back.
  let openChatId: number | null = null;
  const showInbox = (
    entry: HTMLButtonElement = toInbox,
    folderId?: number,
    quote: ChatQuote | null = null,
    openChat = false,
  ): Promise<void> => {
    showing(entry);
    return renderInbox(
      page,
      api,
      (itemId) => {
        void renderItem(
          page,
          api,
          itemId,
          () => void showInbox(entry, folderId),
        );
      },
      (itemIds) => void showHome(itemIds),
      folderId,
      {
        openChatId,
        quote,
        open: openChat,
        onChatOpened: (chatId) => {
          openChatId = chatId;
        },
      },
    );
  };
  const showBriefings = (): Promise<void> => {
    showing(toBriefings);
    return renderBriefings(page, api, (itemId) => {
      void renderItem(
        page,
        api,
        itemId,
        () => void showBriefings(),
        "Back to Briefings",
      );
    });
  };
  // A Note links back to the Item, Briefing or Chat it was saved from.
  const showNotes = (): Promise<void> => {
    showing(toNotes);
    const openItem = (itemId: number): void => {
      void renderItem(
        page,
        api,
        itemId,
        () => void showNotes(),
        "Back to Notes",
      );
    };
    return renderNotes(page, api, (link) => {
      if (link.kind === "item") {
        openItem(link.id);
      } else if (link.kind === "briefing") {
        void renderNoteBriefing(
          page,
          api,
          link.id,
          openItem,
          () => void showNotes(),
        );
      } else {
        openChatId = link.id;
        void showInbox();
      }
    });
  };
  const listFolders = (): Promise<void> =>
    showFolders(api, folderList, (entry, folderId) =>
      showInbox(entry, folderId),
    );
  toHome.addEventListener("click", () => {
    void showHome();
  });
  toInbox.addEventListener("click", () => {
    void showInbox();
  });
  toBriefings.addEventListener("click", () => {
    void showBriefings();
  });
  toNotes.addEventListener("click", () => {
    void showNotes();
  });
  toSources.addEventListener("click", () => {
    showing(toSources);
    void renderSources(page, api, () => void listFolders());
  });
  // Adding or removing a stock adds or removes its ticker-news Source, which the Folders
  // don't show, so the sidebar needs no refresh.
  toStocks.addEventListener("click", () => {
    showing(toStocks);
    void renderStocks(page, api);
  });
  toSettings.addEventListener("click", () => {
    showing(toSettings);
    void renderSettings(page, api, devicePush);
  });
  app.append(header, sidebar, drawer.backdrop, main);
  // Ask AI from a Briefing, an Item or a Chat answer opens the Inbox's Chat with the quote.
  installSelectionPopup(app, api, (quote) => {
    void showInbox(toInbox, undefined, quote);
  });
  root.replaceChildren(app);

  await Promise.all([
    showHealth(api, status),
    showSpendingWarning(api, warning),
    listFolders(),
    openItemId === null
      ? showFirstScreen()
      : renderItem(
          page,
          api,
          openItemId,
          () => void showHome(),
          "Back to Home",
        ),
  ]);

  function showFirstScreen(): Promise<void> {
    switch (shortcut) {
      case "brief":
        return showHome(undefined, true);
      case "chat":
        return showInbox(toInbox, undefined, null, true);
      case "notes":
        return showNotes();
      case null:
        return showHome();
    }
  }
}

interface Drawer {
  menuButton: HTMLButtonElement;
  backdrop: HTMLButtonElement;
  close: () => void;
}

// The sidebar as a drawer on a narrow screen: the Menu button opens it and moves focus into it,
// and the backdrop, the Escape key or choosing a screen closes it. While it is open the page
// behind is inert, so the keyboard stays in the drawer. On a wide screen the stylesheet always
// shows the sidebar and hides the button and the backdrop.
function drawerControls(
  app: HTMLElement,
  sidebar: HTMLElement,
  behind: HTMLElement,
): Drawer {
  const menuButton = navButton("☰");
  menuButton.className = "menu-button";
  menuButton.setAttribute("aria-label", "Menu");
  menuButton.setAttribute("aria-controls", sidebar.id);
  const backdrop = navButton("");
  backdrop.className = "drawer-backdrop";
  backdrop.setAttribute("aria-label", "Close menu");
  // Escape closes it from the keyboard, so the backdrop needn't be a tab stop.
  backdrop.tabIndex = -1;
  const isOpen = (): boolean => app.dataset.drawer === "open";
  const setOpen = (open: boolean): void => {
    app.dataset.drawer = open ? "open" : "closed";
    menuButton.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
    behind.inert = open;
  };
  setOpen(false);
  menuButton.addEventListener("click", () => {
    setOpen(!isOpen());
    if (isOpen()) sidebar.querySelector("button")?.focus();
  });
  backdrop.addEventListener("click", () => {
    setOpen(false);
  });
  app.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    menuButton.focus();
  });
  return {
    menuButton,
    backdrop,
    close: () => {
      setOpen(false);
    },
  };
}

// The Folders in the sidebar, each opening the Inbox filtered to it.
async function showFolders(
  api: ApiClient,
  folderList: HTMLElement,
  showInbox: (entry: HTMLButtonElement, folderId: number) => Promise<void>,
): Promise<void> {
  try {
    const folders = await api.folders();
    folderList.replaceChildren(
      ...folders.map((folder) => {
        const entry = navButton(folder.name);
        entry.addEventListener("click", () => {
          void showInbox(entry, folder.id);
        });
        const row = document.createElement("li");
        row.append(entry);
        return row;
      }),
    );
  } catch (error) {
    // A 401 already sent the owner to login.
    if (error instanceof SignedOutError) return;
    // The screens still work without the Folder list.
    const problem = document.createElement("li");
    const detail = error instanceof Error ? error.message : String(error);
    problem.textContent = `Couldn't load the Folders: ${detail}`;
    folderList.replaceChildren(problem);
  }
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

async function showSpendingWarning(
  api: ApiClient,
  warning: HTMLElement,
): Promise<void> {
  try {
    const banner = spendingBanner(await api.spending());
    if (banner) warning.replaceChildren(banner);
  } catch (error) {
    // A 401 already sent the owner to login.
    if (error instanceof SignedOutError) return;
    const detail = error instanceof Error ? error.message : String(error);
    warning.textContent = `Couldn't check this month's AI spending: ${detail}`;
  }
}

function navButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  return button;
}
