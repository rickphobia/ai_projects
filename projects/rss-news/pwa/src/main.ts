import { HttpApiClient, SignedOutError } from "./api/client";
import { renderLogin } from "./screens/login";
import { renderShell } from "./screens/shell";

const root = document.getElementById("app");
if (!root) {
  throw new Error("index.html has no #app element to render into");
}
const app = root;

function showLogin(): void {
  renderLogin(app, api, showShell);
}

function showShell(): void {
  void renderShell(app, api, showLogin);
}

const api = new HttpApiClient(document.baseURI, showLogin);

// Start on the shell when the session cookie is still good, otherwise on login.
api.checkSession().then(showShell, (error: unknown) => {
  if (error instanceof SignedOutError) return;
  const detail = error instanceof Error ? error.message : String(error);
  app.textContent = `Can't reach the server: ${detail}`;
});
