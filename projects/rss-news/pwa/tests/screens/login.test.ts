import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/api/client";
import { renderLogin } from "../../src/screens/login";
import { FakeApiClient } from "../fake-api";

function submitPassword(password: string): void {
  const input = screen.getByLabelText<HTMLInputElement>("Password");
  input.value = password;
  screen.getByRole("button", { name: "Sign in" }).click();
}

describe("the login screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("main");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("asks only for the password, hidden", () => {
    renderLogin(root, api, () => undefined);

    const input = screen.getByLabelText<HTMLInputElement>("Password");
    expect(input.type).toBe("password");
    expect(input.autocomplete).toBe("current-password");
  });

  it("signs in with the right password", async () => {
    api.loginAnswers = [{ kind: "signed-in" }];
    const onSignedIn = vi.fn();
    renderLogin(root, api, onSignedIn);

    submitPassword("correct horse");

    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce();
    });
    expect(api.passwordsTried).toEqual(["correct horse"]);
  });

  it("says when the password is wrong and clears it", async () => {
    api.loginAnswers = [{ kind: "wrong-password" }];
    const onSignedIn = vi.fn();
    renderLogin(root, api, onSignedIn);

    submitPassword("guess");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Wrong password.");
    });
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe("");
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("says how long a lockout lasts", async () => {
    api.loginAnswers = [{ kind: "locked-out", minutesLeft: 12 }];
    renderLogin(root, api, () => undefined);

    submitPassword("guess");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Too many wrong passwords. Try again in 12 minutes.",
      );
    });
  });

  it("says when the server can't be reached", async () => {
    api.loginAnswers = [new ApiError("POST /api/login answered 502")];
    renderLogin(root, api, () => undefined);

    submitPassword("guess");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Can't reach the server: POST /api/login answered 502",
      );
    });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Sign in" })
        .disabled,
    ).toBe(false);
  });
});
