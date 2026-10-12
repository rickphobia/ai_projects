import type { ApiClient } from "../api/client";

// The login screen: the only screen someone without a session sees.
export function renderLogin(
  root: HTMLElement,
  api: ApiClient,
  onSignedIn: () => void,
): void {
  const heading = document.createElement("h1");
  heading.textContent = "rss-news";

  const form = document.createElement("form");
  const label = document.createElement("label");
  label.textContent = "Password";
  const password = document.createElement("input");
  password.type = "password";
  password.name = "password";
  password.autocomplete = "current-password";
  password.required = true;
  label.append(password);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Sign in";
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  form.append(label, submit, message);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void signIn();
  });

  async function signIn(): Promise<void> {
    submit.disabled = true;
    message.textContent = "";
    try {
      const result = await api.login(password.value);
      switch (result.kind) {
        case "signed-in":
          onSignedIn();
          return;
        case "wrong-password":
          message.textContent = "Wrong password.";
          break;
        case "locked-out": {
          const unit = result.minutesLeft === 1 ? "minute" : "minutes";
          message.textContent = `Too many wrong passwords. Try again in ${String(result.minutesLeft)} ${unit}.`;
          break;
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      message.textContent = `Can't reach the server: ${detail}`;
    }
    password.value = "";
    submit.disabled = false;
    password.focus();
  }

  const card = document.createElement("div");
  card.className = "login";
  card.append(heading, form);
  root.className = "";
  root.replaceChildren(card);
  password.focus();
}
