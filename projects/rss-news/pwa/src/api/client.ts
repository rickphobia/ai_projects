// Every call the PWA makes to the backend goes through an ApiClient: screens get one passed in,
// and tests pass a fake.

export interface Health {
  status: "ok" | "failing";
  database: "ok" | "unreachable";
}

export interface ApiClient {
  health(): Promise<Health>;
}

export class ApiError extends Error {
  override name = "ApiError";
}

export class HttpApiClient implements ApiClient {
  // Paths are relative to this, so the PWA works under whatever prefix serves it.
  constructor(private readonly baseUrl: string) {}

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
}

function isHealth(body: unknown): body is Health {
  if (typeof body !== "object" || body === null) return false;
  const { status, database } = body as Record<string, unknown>;
  return (
    (status === "ok" || status === "failing") &&
    (database === "ok" || database === "unreachable")
  );
}
