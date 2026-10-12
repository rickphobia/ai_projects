import type {
  DeviceSubscription,
  PushSetup,
  TestAlertReport,
} from "../src/api/alerts";
import type {
  Briefing,
  BriefingEstimate,
  BriefingProgress,
  BriefingRequest,
  BriefingSummary,
  WrittenBriefing,
} from "../src/api/briefings";
import type {
  Chat,
  ChatMessage,
  ChatQuote,
  ChatSearch,
  ChatSummary,
} from "../src/api/chats";
import type { Definition } from "../src/api/dictionary";
import type { NewNote, Note } from "../src/api/notes";
import type { OwnerStocks, WatchedStock } from "../src/api/stocks";
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
  SpendingSummary,
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
  latestBriefingAnswer: Briefing | null | Error = null;
  estimateAnswer: BriefingEstimate | Error = {
    itemCount: 12,
    sectionCount: 3,
    estimatedCostUsd: "0.24",
  };
  // The answer to each writeBriefing call in turn: its progress, then its result.
  writeAnswers: {
    progress: BriefingProgress[];
    result: WrittenBriefing | Error;
  }[] = [];
  // The `regenerate` of each writeBriefing call, and its scope.
  writeRequests: boolean[] = [];
  writeScopes: BriefingRequest[] = [];
  // The scope of each briefingEstimate call.
  estimateRequests: BriefingRequest[] = [];
  briefingsAnswer: BriefingSummary[] | Error = [];
  // Saved Briefings by id; one that isn't here is refused as the server would.
  savedBriefings = new Map<number, Briefing>();
  // While true, writeBriefing waits after its progress until the test calls releaseWrite.
  holdWrite = false;
  releaseWrite: (() => void) | null = null;

  spendingAnswer: SpendingSummary | Error = {
    monthStart: "2026-10-01T00:00:00+08:00",
    totalUsd: "12.34",
    limitUsd: "100.00",
    status: "ok",
    byFeature: { scoring: "1.20", briefings: "11.14" },
  };

  spending(): Promise<SpendingSummary> {
    return settle(this.spendingAnswer);
  }

  pushSetupAnswer: PushSetup | Error = {
    available: true,
    publicKey: "BServerKey",
    subscriptions: 0,
  };
  // The endpoints the server holds; subscribe and unsubscribe change it like the backend.
  pushEndpoints = new Set<string>();
  // When set, the next subscribePush is refused with it.
  subscribeError: Error | null = null;
  testAlertAnswer: TestAlertReport | Error = {
    delivered: 1,
    removed: 0,
    failed: 0,
  };
  testAlertsSent = 0;

  pushSetup(): Promise<PushSetup> {
    return settle(this.pushSetupAnswer);
  }

  subscribePush(subscription: DeviceSubscription): Promise<void> {
    const error = this.subscribeError;
    this.subscribeError = null;
    if (error) return Promise.reject(error);
    this.pushEndpoints.add(subscription.endpoint);
    return Promise.resolve();
  }

  unsubscribePush(endpoint: string): Promise<void> {
    this.pushEndpoints.delete(endpoint);
    return Promise.resolve();
  }

  sendTestAlert(): Promise<TestAlertReport> {
    this.testAlertsSent += 1;
    return settle(this.testAlertAnswer);
  }

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

  latestBriefing(): Promise<Briefing | null> {
    return settle(this.latestBriefingAnswer);
  }

  briefings(): Promise<BriefingSummary[]> {
    return settle(this.briefingsAnswer);
  }

  briefing(briefingId: number): Promise<Briefing> {
    return settle(
      this.savedBriefings.get(briefingId) ??
        new Error("That Briefing doesn't exist."),
    );
  }

  briefingEstimate(request: BriefingRequest): Promise<BriefingEstimate> {
    this.estimateRequests.push(request);
    return settle(this.estimateAnswer);
  }

  async writeBriefing(
    request: BriefingRequest,
    regenerate: boolean,
    onProgress: (progress: BriefingProgress) => void,
  ): Promise<WrittenBriefing> {
    this.writeScopes.push(request);
    this.writeRequests.push(regenerate);
    const answer = this.writeAnswers.shift();
    if (!answer) throw new Error("the test set no writeBriefing answer");
    answer.progress.forEach(onProgress);
    if (this.holdWrite) {
      await new Promise<void>((resolve) => {
        this.releaseWrite = resolve;
      });
    }
    return settle(answer.result);
  }

  // Every saved Chat, newest used first, as chats() gives it.
  chatsAnswer: ChatSummary[] | Error = [];
  // Saved Chats by id; one that isn't here is refused as the server would.
  savedChats = new Map<number, Chat>();
  // The answer to each askChat call in turn: its searches, then its result.
  chatAnswers: { searches: ChatSearch[]; result: ChatMessage | Error }[] = [];
  // Each question asked, as [chatId, question].
  questions: [number, string][] = [];
  // The quote sent with each question, or null.
  quotes: (ChatQuote | null)[] = [];
  // Each look-up, as [term, context]; definitionAnswer answers them all.
  lookUps: [string, string][] = [];
  definitionAnswer: Definition | Error = {
    term: "OPR",
    definition: "The rate Bank Negara Malaysia sets for overnight lending.",
    costUsd: "0.0001",
  };
  chatsCreated = 0;

  chats(): Promise<ChatSummary[]> {
    return settle(this.chatsAnswer);
  }

  createChat(): Promise<Chat> {
    this.chatsCreated += 1;
    const created: Chat = {
      id: 100 + this.chatsCreated,
      title: "New Chat",
      createdAt: "2026-10-12T09:00:00+00:00",
      updatedAt: "2026-10-12T09:00:00+00:00",
      costUsd: "0.00",
      messages: [],
    };
    this.savedChats.set(created.id, created);
    return Promise.resolve(created);
  }

  chat(chatId: number): Promise<Chat> {
    return settle(
      this.savedChats.get(chatId) ?? new Error("That Chat doesn't exist."),
    );
  }

  askChat(
    chatId: number,
    question: string,
    onSearched: (search: ChatSearch) => void,
    quote?: ChatQuote,
  ): Promise<ChatMessage> {
    this.questions.push([chatId, question]);
    this.quotes.push(quote ?? null);
    const answer = this.chatAnswers.shift();
    if (!answer) throw new Error("the test set no askChat answer");
    answer.searches.forEach(onSearched);
    // Like the backend, an answered turn is saved with its question; a failed one isn't.
    const saved = this.savedChats.get(chatId);
    if (saved && !(answer.result instanceof Error)) {
      saved.messages.push(
        {
          id: answer.result.id - 1,
          role: "owner",
          createdAt: answer.result.createdAt,
          text: question,
          items: [],
        },
        answer.result,
      );
    }
    return settle(answer.result);
  }

  // The saved Notes, newest first; the calls below change it like the backend.
  savedNotes: Note[] = [];
  notesError: Error | null = null;
  // When set, the next saveNote is refused with it.
  saveNoteError: Error | null = null;
  notesSaved: NewNote[] = [];

  notes(): Promise<Note[]> {
    return settle(this.notesError ?? [...this.savedNotes]);
  }

  saveNote(note: NewNote): Promise<Note> {
    this.notesSaved.push(note);
    const error = this.saveNoteError;
    this.saveNoteError = null;
    if (error) return Promise.reject(error);
    const saved: Note = {
      id: this.notesSaved.length,
      createdAt: "2026-10-12T20:00:00+08:00",
      text: note.text,
      comment: note.comment,
      source: { ...note.source, exists: true },
    };
    this.savedNotes.unshift(saved);
    return Promise.resolve(saved);
  }

  changeNoteComment(noteId: number, comment: string): Promise<Note> {
    const index = this.savedNotes.findIndex((note) => note.id === noteId);
    const note = this.savedNotes[index];
    if (note === undefined) return Promise.reject(new Error("no such Note"));
    const changed = { ...note, comment };
    if (this.changeError === null) this.savedNotes[index] = changed;
    return this.change(["changeNoteComment", noteId, comment], changed);
  }

  deleteNote(noteId: number): Promise<void> {
    if (this.changeError === null) {
      this.savedNotes = this.savedNotes.filter((note) => note.id !== noteId);
    }
    return this.change(["deleteNote", noteId], undefined);
  }

  exportNotes(): Promise<string> {
    return Promise.resolve(
      ["# Notes", ...this.savedNotes.map((note) => `> ${note.text}`)].join(
        "\n\n",
      ),
    );
  }

  // The Watchlist; the calls below change the Watchlist like the backend.
  ownerStocks: OwnerStocks = { watchlist: [] };

  stocks(): Promise<OwnerStocks> {
    return Promise.resolve({
      watchlist: [...this.ownerStocks.watchlist],
    });
  }

  watchStock(ticker: string): Promise<WatchedStock> {
    const watched = {
      ticker: ticker.toUpperCase(),
      addedAt: "2026-10-12T20:00:00+08:00",
    };
    if (this.changeError === null) this.ownerStocks.watchlist.push(watched);
    return this.change(["watchStock", ticker], watched);
  }

  unwatchStock(ticker: string): Promise<void> {
    if (this.changeError === null) {
      this.ownerStocks.watchlist = this.ownerStocks.watchlist.filter(
        (stock) => stock.ticker !== ticker,
      );
    }
    return this.change(["unwatchStock", ticker], undefined);
  }

  defineWord(term: string, context: string): Promise<Definition> {
    this.lookUps.push([term, context]);
    return settle(this.definitionAnswer);
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
