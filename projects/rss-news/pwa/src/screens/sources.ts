import {
  SignedOutError,
  type ApiClient,
  type Folder,
  type NewSource,
  type SourceInfo,
} from "../api/client";

const shownTime = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// Sources and Folders: add a feed URL or subreddit, make, rename and delete Folders, and
// move, pause or remove each Source, seeing when it last fetched and its last error.
export async function renderSources(
  root: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const problem = document.createElement("p");
  problem.setAttribute("role", "alert");
  const addSourceForm = document.createElement("form");
  addSourceForm.setAttribute("aria-label", "Add a Source");
  const address = textInput("Feed URL or subreddit");
  address.placeholder = "https://… or r/LocalLLaMA";
  const targetFolder = document.createElement("select");
  targetFolder.setAttribute("aria-label", "Into Folder");
  addSourceForm.append(labelled(address), targetFolder, submit("Add Source"));
  const addFolderForm = document.createElement("form");
  addFolderForm.setAttribute("aria-label", "Add a Folder");
  const folderName = textInput("New Folder");
  addFolderForm.append(labelled(folderName), submit("Add Folder"));
  const folderList = document.createElement("ul");
  folderList.setAttribute("aria-label", "Folders");
  const sourceList = document.createElement("ul");
  sourceList.setAttribute("aria-label", "Sources");
  root.replaceChildren(
    problem,
    addSourceForm,
    addFolderForm,
    folderList,
    sourceList,
  );

  // Every change reloads both lists, so the screen always shows what the server holds.
  async function act(change: () => Promise<unknown>): Promise<void> {
    problem.textContent = "";
    try {
      await change();
    } catch (error) {
      if (error instanceof SignedOutError) return;
      problem.textContent =
        error instanceof Error ? error.message : String(error);
    }
    await reload();
  }

  async function reload(): Promise<void> {
    try {
      const [folders, sources] = await Promise.all([
        api.folders(),
        api.sources(),
      ]);
      const chosen = targetFolder.value;
      targetFolder.replaceChildren(...folderOptions(folders));
      if (chosen) targetFolder.value = chosen;
      folderList.replaceChildren(
        ...folders.map((folder) => folderRow(folder, act, api)),
      );
      sourceList.replaceChildren(
        ...sources.map((source) => sourceRow(source, folders, act, api)),
      );
    } catch (error) {
      if (error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      problem.textContent = `Couldn't load the Sources: ${detail}`;
    }
  }

  addSourceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const typed = address.value.trim();
    if (!typed) return;
    void act(async () => {
      await api.addSource(newSource(Number(targetFolder.value), typed));
      address.value = "";
    });
  });
  addFolderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = folderName.value.trim();
    if (!name) return;
    void act(async () => {
      await api.addFolder(name);
      folderName.value = "";
    });
  });

  await reload();
}

// What the owner typed decides the kind: a web address is a feed, anything else a subreddit.
export function newSource(folderId: number, typed: string): NewSource {
  return /^https?:\/\//i.test(typed)
    ? { folderId, url: typed }
    : { folderId, subreddit: typed };
}

type Act = (change: () => Promise<unknown>) => Promise<void>;

function folderRow(folder: Folder, act: Act, api: ApiClient): HTMLLIElement {
  const row = document.createElement("li");
  const name = textInput(`Folder name ${folder.name}`);
  name.value = folder.name;
  const rename = button("Rename", () => {
    void act(() => api.renameFolder(folder.id, name.value.trim()));
  });
  const remove = button("Delete", () => {
    void act(() => api.deleteFolder(folder.id));
  });
  remove.setAttribute("aria-label", `Delete ${folder.name}`);
  rename.setAttribute("aria-label", `Rename ${folder.name}`);
  row.append(name, rename, remove);
  return row;
}

function sourceRow(
  source: SourceInfo,
  folders: Folder[],
  act: Act,
  api: ApiClient,
): HTMLLIElement {
  const row = document.createElement("li");
  const title = document.createElement("strong");
  title.textContent = source.paused ? `${source.name} (paused)` : source.name;
  const health = document.createElement("small");
  health.textContent = ` ${healthOf(source)}`;
  const move = document.createElement("select");
  move.setAttribute("aria-label", `Folder of ${source.name}`);
  move.append(...folderOptions(folders));
  move.value = String(source.folderId);
  move.addEventListener("change", () => {
    void act(() =>
      api.changeSource(source.id, { folderId: Number(move.value) }),
    );
  });
  const pause = button(source.paused ? "Resume" : "Pause", () => {
    void act(() => api.changeSource(source.id, { paused: !source.paused }));
  });
  pause.setAttribute(
    "aria-label",
    `${source.paused ? "Resume" : "Pause"} ${source.name}`,
  );
  const remove = button("Remove", () => {
    if (!window.confirm(`Remove ${source.name} and its Items?`)) return;
    void act(() => api.removeSource(source.id));
  });
  remove.setAttribute("aria-label", `Remove ${source.name}`);
  row.append(title, health, move, pause, remove);
  return row;
}

function healthOf(source: SourceInfo): string {
  const success = source.lastSuccessAt
    ? `Last fetched ${shownTime.format(new Date(source.lastSuccessAt))}`
    : "Never fetched";
  if (source.lastError === null || source.lastErrorAt === null) return success;
  // An error older than the last success is history; only a newer one means it's broken now.
  const failing =
    source.lastSuccessAt === null ||
    new Date(source.lastErrorAt) > new Date(source.lastSuccessAt);
  const error = `${failing ? "Failing" : "Last error"} ${shownTime.format(new Date(source.lastErrorAt))}: ${source.lastError}`;
  return `${success} · ${error}`;
}

function folderOptions(folders: Folder[]): HTMLOptionElement[] {
  return folders.map((folder) => new Option(folder.name, String(folder.id)));
}

function textInput(label: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("aria-label", label);
  return input;
}

function labelled(input: HTMLInputElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.textContent = input.getAttribute("aria-label");
  label.append(input);
  return label;
}

function submit(text: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "submit";
  element.textContent = text;
  return element;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}
