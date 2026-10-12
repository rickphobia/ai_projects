import "./styles.css";
import { HttpApiClient, SignedOutError } from "./api/client";
import { browserDevicePush } from "./pwa/device-push";
import { itemIdInPageUrl } from "./pwa/opened-item";
import { registerServiceWorker } from "./pwa/register";
import { shortcutInPageUrl } from "./pwa/shortcut";
import { renderLogin } from "./screens/login";
import { renderShell } from "./screens/shell";

const root = document.getElementById("app");
if (!root) {
  throw new Error("index.html has no #app element to render into");
}
const app = root;
const devicePush = browserDevicePush(
  navigator.serviceWorker,
  typeof Notification === "undefined" ? undefined : Notification,
);

// A tapped Alert opens the app on its Item. It is opened once, even if login comes first, and
// dropped from the address so reloading shows the home screen.
// An app icon shortcut is handled the same way.
let openItemId = itemIdInPageUrl(location.href);
let shortcut = shortcutInPageUrl(location.href);
if (openItemId !== null || shortcut !== null) {
  history.replaceState(null, "", new URL("./", location.href));
}

function showLogin(): void {
  renderLogin(app, api, showShell);
}

function showShell(): void {
  void renderShell(app, api, showLogin, { devicePush, openItemId, shortcut });
  openItemId = null;
  shortcut = null;
}

const api = new HttpApiClient(document.baseURI, showLogin);

// Start on the shell when the session cookie is still good, otherwise on login.
api.checkSession().then(showShell, (error: unknown) => {
  if (error instanceof SignedOutError) return;
  const detail = error instanceof Error ? error.message : String(error);
  app.textContent = `Can't reach the server: ${detail}`;
});

// reportError shows the failure in the browser console without stopping the app.
registerServiceWorker(navigator.serviceWorker, document.baseURI, reportError);
