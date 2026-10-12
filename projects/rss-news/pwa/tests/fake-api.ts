import type {
  ApiClient,
  Folder,
  Health,
  InboxItem,
  InboxPage,
  InboxQuery,
  LoginResult,
  ReaderView,
  NewSource,
  SourceChange,
  SourceInfo,
} from "../src/api/client";

// A stand-in ApiClient: each answer is set per test, and calls are recorded.
export class FakeApiClient implements ApiClient {
  healthAnswer: Health | Error = { status: "ok", database: "ok" };
  loginAnswers: (LoginResult | Error)[] = [];
  logoutAnswer: Error | null = null;
  passwordsTried: string[] = [];
  logouts = 0;
  foldersAnswer: Folder[] | Error = [];
  // The whole Inbox, newest first; inbox() filters and pages it like the backend.
  items: InboxItem[] = [];
  inboxError: Error | null = null;
  pageSize = 50;
  inboxQueries: InboxQuery[] = [];
  // Reader view per Item id; an Item without one fails as the server would.
  readerViews = new Map<number, ReaderView | Error>();
  // While true, readerView() waits until the test calls releaseReaderView.
  holdReaderView = false;
  releaseReaderView: (() => void) | null = null;
  itemsOpened: number[] = [];
  sourcesAnswer: SourceInfo[] = [];
  // When set, the next change is refused with it.
  changeError: Error | null = null;
  // Every change asked for, in order, as [call, ...arguments].
  changes: unknown[][] = [];

  health(): Promise<Health> {
    return settle(this.healthAnswer);
  }

  login(password: string): Promise<LoginResult> {
    this.passwordsTried.push(password);
    const answer = this.loginAnswers.shift();
    if (!answer) throw new Error("the test set no login answer");
    return settle(answer);
  }

  logout(): Promise<void> {
    this.logouts += 1;
    return this.logoutAnswer
      ? Promise.reject(this.logoutAnswer)
      : Promise.resolve();
  }

  checkSession(): Promise<void> {
    return Promise.resolve();
  }

  folders(): Promise<Folder[]> {
    return settle(this.foldersAnswer);
  }

  inbox(query: InboxQuery): Promise<InboxPage> {
    this.inboxQueries.push(query);
    if (this.inboxError) return Promise.reject(this.inboxError);
    const matching = this.items.filter(
      (item) =>
        (query.folderId === undefined || item.folder.id === query.folderId) &&
        (query.minImportance === undefined ||
          (item.importance ?? 0) >= query.minImportance) &&
        (query.search === undefined ||
          query.search
            .toLowerCase()
            .split(/\s+/)
            .every((word) => item.title.toLowerCase().includes(word))),
    );
    if (query.sort === "importance") {
      // A stable sort keeps newest first within one Importance.
      matching.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
    }
    const start = query.cursor === undefined ? 0 : Number(query.cursor);
    const end = start + this.pageSize;
    return Promise.resolve({
      items: matching.slice(start, end),
      nextCursor: end < matching.length ? String(end) : null,
    });
  }

  item(itemId: number): Promise<InboxItem> {
    this.itemsOpened.push(itemId);
    const found = this.items.find((item) => item.id === itemId);
    if (!found) return Promise.reject(new Error(`no Item ${String(itemId)}`));
    found.read = true;
    return Promise.resolve({ ...found });
  }

  async readerView(itemId: number): Promise<ReaderView> {
    if (this.holdReaderView) {
      await new Promise<void>((resolve) => {
        this.releaseReaderView = resolve;
      });
    }
    return settle(
      this.readerViews.get(itemId) ??
        new Error("Reader view isn't available: no article text was found."),
    );
  }

  // Changes are only recorded; the lists stay as the test set them.
  sources(): Promise<SourceInfo[]> {
    return Promise.resolve(this.sourcesAnswer);
  }

  addFolder(name: string): Promise<Folder> {
    return this.change<Folder>(["addFolder", name], { id: 99, name });
  }

  renameFolder(folderId: number, name: string): Promise<void> {
    return this.change(["renameFolder", folderId, name], undefined);
  }

  deleteFolder(folderId: number): Promise<void> {
    return this.change(["deleteFolder", folderId], undefined);
  }

  addSource(source: NewSource): Promise<SourceInfo> {
    return this.change(["addSource", source], {} as SourceInfo);
  }

  changeSource(sourceId: number, change: SourceChange): Promise<SourceInfo> {
    return this.change(["changeSource", sourceId, change], {} as SourceInfo);
  }

  removeSource(sourceId: number): Promise<void> {
    return this.change(["removeSource", sourceId], undefined);
  }

  private change<T>(call: unknown[], answer: T): Promise<T> {
    this.changes.push(call);
    const error = this.changeError;
    this.changeError = null;
    return settle(error ?? answer);
  }
}

function settle<T>(answer: T | Error): Promise<T> {
  return answer instanceof Error
    ? Promise.reject(answer)
    : Promise.resolve(answer);
}
