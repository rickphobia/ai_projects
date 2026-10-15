import { SignedOutError, type ApiClient } from "../api/client";

// The sidebar's parts: the drawer it becomes on a phone, and its list of Folders.

interface Drawer {
  menuButton: HTMLButtonElement;
  backdrop: HTMLButtonElement;
  close: () => void;
}

// The sidebar as a drawer on a narrow screen: the Menu button opens it and moves focus into it,
// and the backdrop, the Escape key or choosing a screen closes it. While it is open the page
// behind is inert, so the keyboard stays in the drawer. On a wide screen the stylesheet always
// shows the sidebar and hides the button and the backdrop.
export function drawerControls(
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
export async function showFolders(
  api: ApiClient,
  folderList: HTMLElement,
  showInbox: (folderId: number) => void,
): Promise<void> {
  try {
    const folders = await api.folders();
    folderList.replaceChildren(
      ...folders.map((folder) => {
        const entry = navButton(folder.name);
        entry.dataset.folderId = String(folder.id);
        entry.addEventListener("click", () => {
          showInbox(folder.id);
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

// A button in the sidebar or the header.
export function navButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  return button;
}
