import { SignedOutError, type ApiClient } from "../api/client";

// The app shell for a signed-in owner: the name, whether the backend is up, and sign out.
// Later screens replace the body.
export async function renderShell(
  root: HTMLElement,
  api: ApiClient,
  onSignedOut: () => void,
): Promise<void> {
  const heading = document.createElement("h1");
  heading.textContent = "rss-news";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Checking the server…";
  const signOut = document.createElement("button");
  signOut.type = "button";
  signOut.textContent = "Sign out";
  signOut.addEventListener("click", () => {
    api.logout().then(onSignedOut, (error: unknown) => {
      // A 401 already sent the owner to login.
      if (error instanceof SignedOutError) return;
      const detail = error instanceof Error ? error.message : String(error);
      status.textContent = `Couldn't sign out: ${detail}`;
    });
  });
  root.replaceChildren(heading, status, signOut);

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
