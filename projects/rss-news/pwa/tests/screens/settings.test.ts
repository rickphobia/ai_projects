import { screen, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError, RefusedError } from "../../src/api/client";
import { noDevicePush } from "../../src/pwa/device-push";
import { renderSettings } from "../../src/screens/settings";
import { renderShell } from "../../src/screens/shell";
import { FakeApiClient } from "../fake-api";
import { FakeDevicePush } from "../fake-device-push";

describe("the Settings screen", () => {
  let root: HTMLElement;
  let api: FakeApiClient;

  beforeEach(() => {
    root = document.createElement("main");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
  });

  it("shows this month's cost by feature against the limit", async () => {
    await renderSettings(root, api, noDevicePush);

    expect(root.textContent).toContain("$12.34 of the $100.00 monthly limit");
    const features = screen.getByRole("list", { name: "Cost by feature" });
    expect(Array.from(features.children, (line) => line.textContent)).toEqual([
      "Scoring: $1.20",
      "Briefings: $11.14",
    ]);
    expect(screen.queryByRole("alert", { name: "Spending" })).toBeNull();
  });

  it("warns from 80% of the limit", async () => {
    api.spendingAnswer = {
      monthStart: "2026-10-01T00:00:00+08:00",
      totalUsd: "82.00",
      limitUsd: "100.00",
      status: "warning",
      byFeature: { scoring: "2.00", briefings: "80.00" },
    };

    await renderSettings(root, api, noDevicePush);

    expect(
      screen.getByRole("alert", { name: "Spending" }).textContent,
    ).toContain("$82.00 of the $100.00 monthly limit");
  });

  it("says Briefings are off once the limit is reached", async () => {
    api.spendingAnswer = {
      monthStart: "2026-10-01T00:00:00+08:00",
      totalUsd: "100.40",
      limitUsd: "100.00",
      status: "stopped",
      byFeature: { scoring: "2.00", briefings: "98.40" },
    };

    await renderSettings(root, api, noDevicePush);

    expect(
      screen.getByRole("alert", { name: "Spending" }).textContent,
    ).toContain("Briefings are off until next month");
  });

  it("says when spending can't load", async () => {
    api.spendingAnswer = new ApiError("GET api/spending answered 500");

    await renderSettings(root, api, noDevicePush);

    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't load spending: GET api/spending answered 500",
    );
  });

  it("is opened from the shell, which shows the warning on every screen", async () => {
    api.spendingAnswer = { ...(await api.spending()), status: "warning" };
    await renderShell(root, api, () => undefined);

    expect(screen.getByRole("alert", { name: "Spending" })).toBeTruthy();
    screen.getByRole("button", { name: "Settings" }).click();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Spending this month" }),
      ).toBeTruthy();
    });
  });
});

describe("the Alerts settings", () => {
  let root: HTMLElement;
  let api: FakeApiClient;
  let phone: FakeDevicePush;

  beforeEach(() => {
    root = document.createElement("main");
    document.body.replaceChildren(root);
    api = new FakeApiClient();
    phone = new FakeDevicePush();
  });

  const optIn = (): HTMLInputElement =>
    screen.getByRole("checkbox", { name: "Alerts on this phone" });
  const testButton = (): HTMLButtonElement =>
    screen.getByRole("button", { name: "Send a test Alert" });
  const status = (): string | null =>
    screen.getByRole("status", { name: "Alerts" }).textContent;

  it("turns Alerts on for this phone with the server's key", async () => {
    await renderSettings(root, api, phone);
    expect(status()).toBe("Alerts are off for this phone.");
    expect(optIn().checked).toBe(false);
    expect(testButton().disabled).toBe(true);

    optIn().click();

    await waitFor(() => {
      expect(status()).toBe("Alerts are on for this phone.");
    });
    expect(phone.keysUsed).toEqual(["BServerKey"]);
    expect([...api.pushEndpoints]).toEqual([
      "https://fcm.googleapis.com/fcm/send/this-phone",
    ]);
    expect(testButton().disabled).toBe(false);
  });

  it("shows the quiet hours and the daily cap", async () => {
    await renderSettings(root, api, phone);

    expect(screen.getByLabelText("Alert limits").textContent).toBe(
      "No Alerts from 23:00 to 07:00, and at most 10 a day. Alerts held back by these are dropped; the Items stay in the Inbox.",
    );
  });

  it("turns Alerts off and tells the server to forget the phone", async () => {
    await phone.subscribe("BServerKey");
    await renderSettings(root, api, phone);
    expect(optIn().checked).toBe(true);
    // Opening Settings sends the phone's subscription again, so the server has it.
    expect(api.pushEndpoints.size).toBe(1);

    optIn().click();

    await waitFor(() => {
      expect(status()).toBe("Alerts are off for this phone.");
    });
    expect(phone.subscription).toBeNull();
    expect(api.pushEndpoints.size).toBe(0);
    expect(testButton().disabled).toBe(true);
  });

  it("drops a subscription made with a key the server no longer has", async () => {
    await phone.subscribe("BOldServerKey");
    api.pushEndpoints.add("https://fcm.googleapis.com/fcm/send/this-phone");

    await renderSettings(root, api, phone);

    expect(status()).toBe("Alerts are off for this phone.");
    expect(optIn().checked).toBe(false);
    expect(phone.subscription).toBeNull();
    expect(api.pushEndpoints.size).toBe(0);
  });

  it("says so and stays off when notifications are blocked", async () => {
    phone.permissionDenied = true;
    await renderSettings(root, api, phone);

    optIn().click();

    await waitFor(() => {
      expect(status()).toContain(
        "Couldn't turn Alerts on: Notifications are blocked",
      );
    });
    expect(optIn().checked).toBe(false);
    expect(api.pushEndpoints.size).toBe(0);
  });

  it("sends a test Alert and reports where it went", async () => {
    await phone.subscribe("BServerKey");
    api.testAlertAnswer = { delivered: 1, removed: 1, failed: 0 };
    await renderSettings(root, api, phone);

    testButton().click();

    await waitFor(() => {
      expect(status()).toBe(
        "Test Alert sent to 1 phone. 1 phone no longer taking Alerts was forgotten.",
      );
    });
    expect(api.testAlertsSent).toBe(1);
  });

  it("shows why a test Alert was refused", async () => {
    await phone.subscribe("BServerKey");
    api.testAlertAnswer = new RefusedError(
      "Turn Alerts on for this phone first.",
    );
    await renderSettings(root, api, phone);

    testButton().click();

    await waitFor(() => {
      expect(status()).toBe(
        "Couldn't send a test Alert: Turn Alerts on for this phone first.",
      );
    });
  });

  it("says when the server has no key for Alerts", async () => {
    api.pushSetupAnswer = {
      available: false,
      publicKey: null,
      subscriptions: 0,
      quietHours: { start: "23:00", end: "07:00" },
      dailyCap: 10,
    };

    await renderSettings(root, api, phone);

    expect(status()).toBe("Alerts aren't set up on the server yet.");
    expect(optIn().disabled).toBe(true);
  });

  it("says when this browser can't receive Alerts", async () => {
    await renderSettings(root, api, noDevicePush);

    expect(status()).toContain("This browser can't receive Alerts.");
    expect(optIn().disabled).toBe(true);
  });
});
