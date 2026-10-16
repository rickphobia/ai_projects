import type { ChatQuote } from "../api/chats";
import { SignedOutError, type ApiClient } from "../api/client";
import { noDevicePush, type DevicePush } from "../pwa/device-push";
import type { Shortcut } from "../pwa/shortcut";
import { renderBriefings, renderSavedBriefing } from "./briefings";
import { renderHome } from "./home";
import { renderInbox } from "./inbox";
import { renderItem } from "./item";
import { neighbours } from "./item-end";
import { Navigation, type Visit } from "./navigation";
import { renderNoteBriefing, renderNotes } from "./notes";
import { backLabel, routeFromHash, type Route } from "./routes";
import { installSelectionPopup } from "./selection";
import { renderSettings, spendingBanner } from "./settings";
import { drawerControls, navButton, showFolders } from "./sidebar";
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
// the Notes, the Sources, the Stocks or the Settings screen. Each screen has an address, and the
// browser's Back and Forward move between them (see navigation.ts).
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

  // Marks the screen being shown in the sidebar and closes the drawer. An Item or a Briefing
  // marks the screen it was opened from.
  const showing = (route: Route, from: Route | null): void => {
    for (const entry of sidebar.querySelectorAll("button")) {
      entry.removeAttribute("aria-current");
    }
    sidebarEntry(route, from)?.setAttribute("aria-current", "page");
    drawer.close();
  };
  const sidebarEntry = (
    route: Route,
    from: Route | null,
  ): HTMLButtonElement | null => {
    switch (route.screen) {
      case "home":
        return toHome;
      case "inbox":
        return (
          (route.folderId === undefined
            ? null
            : folderList.querySelector<HTMLButtonElement>(
                `[data-folder-id="${String(route.folderId)}"]`,
              )) ?? toInbox
        );
      case "item":
        return from === null || from.screen === "item"
          ? null
          : sidebarEntry(from, null);
      case "briefings":
      case "briefing":
        return toBriefings;
      case "notes":
      case "note-briefing":
        return toNotes;
      case "sources":
        return toSources;
      case "stocks":
        return toStocks;
      case "settings":
        return toSettings;
    }
  };
  // The Chat open in the Inbox, so it is still there after going to an Item and back.
  let openChatId: number | null = null;
  // From the Inbox, with its list, so the Item view can go on to the next Item.
  const openItem = (itemId: number, listedIds?: number[]): void => {
    void navigation.go(
      { screen: "item", itemId },
      listedIds === undefined ? {} : { listedIds },
    );
  };
  const show = (visit: Visit, once: Once = {}): Promise<void> => {
    const { route } = visit;
    showing(route, visit.from);
    switch (route.screen) {
      case "home":
        return renderHome(
          page,
          api,
          openItem,
          visit.pickedItemIds,
          once.briefNow ?? false,
        );
      case "inbox":
        return renderInbox(
          page,
          api,
          openItem,
          (itemIds) =>
            void navigation.go({ screen: "home" }, { pickedItemIds: itemIds }),
          route.folderId,
          {
            openChatId,
            quote: once.quote ?? null,
            open: once.openChat ?? false,
            onChatOpened: (chatId) => {
              openChatId = chatId;
            },
          },
        );
      case "item":
        return renderItem(page, api, route.itemId, {
          onBack: () => {
            navigation.back({ screen: "home" });
          },
          backLabel: backLabel(visit.from),
          ...neighbours(route.itemId, visit.listedIds ?? []),
          onMove: (itemId) =>
            void navigation.replace({ screen: "item", itemId }),
        });
      case "briefings":
        return renderBriefings(page, api, (briefingId) => {
          void navigation.go({ screen: "briefing", briefingId });
        });
      case "briefing":
        return renderSavedBriefing(
          page,
          api,
          route.briefingId,
          openItem,
          () => {
            navigation.back({ screen: "briefings" });
          },
        );
      // A Note links back to the Item, Briefing or Chat it was saved from.
      case "notes":
        return renderNotes(page, api, (link) => {
          if (link.kind === "item") {
            openItem(link.id);
          } else if (link.kind === "briefing") {
            void navigation.go({
              screen: "note-briefing",
              briefingId: link.id,
            });
          } else {
            openChatId = link.id;
            void navigation.go({ screen: "inbox" });
          }
        });
      case "note-briefing":
        return renderNoteBriefing(page, api, route.briefingId, openItem, () => {
          navigation.back({ screen: "notes" });
        });
      case "sources":
        return renderSources(page, api, () => void listFolders());
      // Adding or removing a stock adds or removes its ticker-news Source, which the Folders
      // don't show, so the sidebar needs no refresh.
      case "stocks":
        return renderStocks(page, api);
      case "settings":
        return renderSettings(page, api, devicePush);
    }
  };
  const navigation = new Navigation<Once>(show, () => app.isConnected);
  const listFolders = (): Promise<void> =>
    showFolders(api, folderList, (folderId) => {
      void navigation.go({ screen: "inbox", folderId });
    });
  const sidebarRoutes: [HTMLButtonElement, Route][] = [
    [toHome, { screen: "home" }],
    [toInbox, { screen: "inbox" }],
    [toBriefings, { screen: "briefings" }],
    [toNotes, { screen: "notes" }],
    [toSources, { screen: "sources" }],
    [toStocks, { screen: "stocks" }],
    [toSettings, { screen: "settings" }],
  ];
  for (const [entry, route] of sidebarRoutes) {
    entry.addEventListener("click", () => {
      void navigation.go(route);
    });
  }
  app.append(header, sidebar, drawer.backdrop, main);
  // Ask AI from a Briefing, an Item or a Chat answer opens the Inbox's Chat with the quote.
  installSelectionPopup(app, api, (quote) => {
    void navigation.go({ screen: "inbox" }, { once: { quote } });
  });
  root.replaceChildren(app);

  await Promise.all([
    showHealth(api, status),
    showSpendingWarning(api, warning),
    // A Folder's Inbox opened from its address is marked once the Folders are in.
    listFolders().then(() => {
      const { route, from } = navigation.visit();
      showing(route, from);
    }),
    startScreen(),
  ]);

  // An Alert or an app icon shortcut names the first screen; otherwise it is the one in the
  // address, as after a reload, or Home.
  function startScreen(): Promise<void> {
    if (openItemId !== null) {
      return navigation.start({ screen: "item", itemId: openItemId });
    }
    switch (shortcut) {
      case "brief":
        return navigation.start({ screen: "home" }, { briefNow: true });
      case "chat":
        return navigation.start({ screen: "inbox" }, { openChat: true });
      case "notes":
        return navigation.start({ screen: "notes" });
      case null:
        return navigation.start(routeFromHash(location.hash));
    }
  }
}

// What one showing of a screen gets that its history entry doesn't keep.
interface Once {
  // Brief me presses itself, for the Brief me (24h) shortcut.
  briefNow?: boolean;
  // Ask AI's quote for the Chat.
  quote?: ChatQuote;
  // The Chat sheet starts open, for the Chat shortcut.
  openChat?: boolean;
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
