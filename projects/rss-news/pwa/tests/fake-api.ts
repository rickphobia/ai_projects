import type {
  ApiClient,
  Folder,
  Health,
  InboxItem,
  InboxPage,
  InboxQuery,
  LoginResult,
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
        query.folderId === undefined || item.folder.id === query.folderId,
    );
    const start = query.cursor === undefined ? 0 : Number(query.cursor);
    const end = start + this.pageSize;
    return Promise.resolve({
      items: matching.slice(start, end),
      nextCursor: end < matching.length ? String(end) : null,
    });
  }
}

function settle<T>(answer: T | Error): Promise<T> {
  return answer instanceof Error
    ? Promise.reject(answer)
    : Promise.resolve(answer);
}
