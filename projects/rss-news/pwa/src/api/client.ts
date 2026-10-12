// Every call the PWA makes to the backend goes through an ApiClient: screens get one passed in,
// and tests pass a fake.

export interface Health {
  status: "ok" | "failing";
  database: "ok" | "unreachable";
}

export interface Folder {
  id: number;
  name: string;
}

export interface InboxItem {
  id: number;
  title: string;
  // The original page, opened in a new tab.
  url: string;
  source: string;
  folder: Folder;
  // ISO 8601 with a time zone.
  publishedAt: string;
  // 1 to 5, and one line in English; both null until the Item is scored.
  importance: number | null;
  summary: string | null;
}

export type InboxOrder = "newest" | "importance";

export interface InboxQuery {
  // Only this Folder's Items; all Folders when left out.
  folderId?: number;
  // Only Items scored at least this; unscored Items are left out.
  minImportance?: number;
  // Newest first when left out.
  sort?: InboxOrder;
  // The last page's nextCursor, for the page after it.
  cursor?: string;
}

export interface InboxPage {
  items: InboxItem[];
  // Null on the last page.
  nextCursor: string | null;
}

export type LoginResult =
  | { kind: "signed-in" }
  | { kind: "wrong-password" }
  | { kind: "locked-out"; minutesLeft: number };

export interface ApiClient {
  health(): Promise<Health>;
  login(password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  // Resolves when signed in; otherwise the client sends the owner to login and rejects.
  checkSession(): Promise<void>;
  folders(): Promise<Folder[]>;
  inbox(query: InboxQuery): Promise<InboxPage>;
}

export class ApiError extends Error {
  override name = "ApiError";
}

// The session is missing or expired. The client has already sent the owner to login.
export class SignedOutError extends ApiError {
  override name = "SignedOutError";
}

export class HttpApiClient implements ApiClient {
  // Paths are relative to baseUrl, so the PWA works under whatever prefix serves it.
  // onSignedOut runs when any call needing a session answers 401.
  constructor(
    private readonly baseUrl: string,
    private readonly onSignedOut: () => void,
  ) {}

  async health(): Promise<Health> {
    const url = new URL("healthz", this.baseUrl);
    const response = await fetch(url);
    // A failing check answers 503 with the same body, so read it either way.
    const body: unknown = await response.json().catch(() => null);
    if (!isHealth(body)) {
      throw new ApiError(
        `GET ${url.pathname} answered ${String(response.status)} without a health report`,
      );
    }
    return body;
  }

  async login(password: string): Promise<LoginResult> {
    const response = await this.send("POST", "api/login", { password });
    if (response.status === 204) return { kind: "signed-in" };
    if (response.status === 401) return { kind: "wrong-password" };
    if (response.status === 429) {
      const body: unknown = await response.json().catch(() => null);
      return { kind: "locked-out", minutesLeft: minutesLeftIn(body) };
    }
    throw unexpected("POST", response);
  }

  async logout(): Promise<void> {
    await this.sendWithSession("POST", "api/logout");
  }

  async checkSession(): Promise<void> {
    await this.sendWithSession("GET", "api/session");
  }

  async folders(): Promise<Folder[]> {
    const response = await this.sendWithSession("GET", "api/folders");
    const body = (await response.json()) as { folders: Folder[] };
    return body.folders;
  }

  async inbox(query: InboxQuery): Promise<InboxPage> {
    const params = new URLSearchParams();
    if (query.folderId !== undefined) {
      params.set("folder", String(query.folderId));
    }
    if (query.minImportance !== undefined) {
      params.set("min_importance", String(query.minImportance));
    }
    if (query.sort !== undefined) params.set("sort", query.sort);
    if (query.cursor !== undefined) params.set("cursor", query.cursor);
    const path =
      params.size > 0 ? `api/inbox?${params.toString()}` : "api/inbox";
    const response = await this.sendWithSession("GET", path);
    const body = (await response.json()) as InboxPageJson;
    return {
      items: body.items.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        folder: item.folder,
        publishedAt: item.published_at,
        importance: item.importance,
        summary: item.summary,
      })),
      nextCursor: body.next_cursor,
    };
  }

  // For every call except login: a 401 means the session is gone, so go to login.
  private async sendWithSession(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const response = await this.send(method, path, body);
    if (response.status === 401) {
      this.onSignedOut();
      throw new SignedOutError(`${method} ${path} needs a session`);
    }
    if (!response.ok) throw unexpected(method, response);
    return response;
  }

  private send(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    return fetch(new URL(path, this.baseUrl), {
      method,
      // The session cookie is HttpOnly; the browser sends it on same-origin calls.
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    });
  }
}

// The Inbox as the backend sends it, in snake_case.
interface InboxPageJson {
  items: {
    id: number;
    title: string;
    url: string;
    source: string;
    folder: Folder;
    published_at: string;
    importance: number | null;
    summary: string | null;
  }[];
  next_cursor: string | null;
}

function unexpected(method: string, response: Response): ApiError {
  return new ApiError(
    `${method} ${new URL(response.url || "http://unknown/").pathname} answered ${String(response.status)}`,
  );
}

function minutesLeftIn(body: unknown): number {
  if (typeof body === "object" && body !== null) {
    const { minutes_left: minutes } = body as Record<string, unknown>;
    if (typeof minutes === "number" && minutes > 0) return minutes;
  }
  return 1;
}

function isHealth(body: unknown): body is Health {
  if (typeof body !== "object" || body === null) return false;
  const { status, database } = body as Record<string, unknown>;
  return (
    (status === "ok" || status === "failing") &&
    (database === "ok" || database === "unreachable")
  );
}
