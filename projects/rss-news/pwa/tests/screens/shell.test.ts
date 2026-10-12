import { screen } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError, type ApiClient, type Health } from "../../src/api/client";
import { renderShell } from "../../src/screens/shell";

class FakeApiClient implements ApiClient {
  constructor(private readonly answer: Health | ApiError) {}

  health(): Promise<Health> {
    return this.answer instanceof ApiError
      ? Promise.reject(this.answer)
      : Promise.resolve(this.answer);
  }
}

describe("the app shell", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("main");
    document.body.replaceChildren(root);
  });

  it("names the app and says the server is up", async () => {
    await renderShell(
      root,
      new FakeApiClient({ status: "ok", database: "ok" }),
    );

    expect(screen.getByRole("heading", { name: "rss-news" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("The server is up.");
  });

  it("says when the database is unreachable", async () => {
    await renderShell(
      root,
      new FakeApiClient({ status: "failing", database: "unreachable" }),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "database is unreachable",
    );
  });

  it("says when the server can't be reached", async () => {
    await renderShell(
      root,
      new FakeApiClient(new ApiError("GET /healthz answered 502")),
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Can't reach the server: GET /healthz answered 502",
    );
  });
});
