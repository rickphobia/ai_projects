import type { ApiClient } from "../api/client";

// The empty app shell: the name and whether the backend is up. Later screens replace the body.
export async function renderShell(
  root: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const heading = document.createElement("h1");
  heading.textContent = "rss-news";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Checking the server…";
  root.replaceChildren(heading, status);

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
