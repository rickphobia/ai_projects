import type { TestAlertReport } from "../api/alerts";
import {
  SignedOutError,
  type ApiClient,
  type SpendingSummary,
} from "../api/client";
import type { DevicePush } from "../pwa/device-push";
import { showInReadingColumn } from "./reading-column";

// The features the spending page names, in the order it lists them.
const featureNames: Record<string, string> = {
  scoring: "Scoring",
  briefings: "Briefings",
};

// Settings: this month's AI cost by feature against the monthly limit, with the warning
// banner from 80%, then Alerts: turning them on for this phone, sending a test Alert, and the
// quiet hours and daily cap that hold them back.
export async function renderSettings(
  root: HTMLElement,
  api: ApiClient,
  devicePush: DevicePush,
): Promise<void> {
  const spending = document.createElement("section");
  const alerts = document.createElement("section");
  showInReadingColumn(root, "div", spending, alerts);
  await Promise.all([
    showSpending(spending, api),
    showAlerts(alerts, api, devicePush),
  ]);
}

async function showSpending(
  section: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const heading = document.createElement("h2");
  heading.textContent = "Spending this month";
  section.append(heading);
  let summary: SpendingSummary;
  try {
    summary = await api.spending();
  } catch (error) {
    if (error instanceof SignedOutError) return;
    const problem = document.createElement("p");
    problem.setAttribute("role", "alert");
    problem.textContent = `Couldn't load spending: ${messageOf(error)}`;
    section.append(problem);
    return;
  }
  const total = document.createElement("p");
  total.textContent = `$${summary.totalUsd} of the $${summary.limitUsd} monthly limit`;
  const features = document.createElement("ul");
  features.setAttribute("aria-label", "Cost by feature");
  features.className = "rows";
  for (const [feature, cost] of Object.entries(summary.byFeature)) {
    const line = document.createElement("li");
    line.textContent = `${featureNames[feature] ?? feature}: $${cost}`;
    features.append(line);
  }
  const banner = spendingBanner(summary);
  section.append(...(banner ? [banner] : []), total, features);
}

// The opt-in shows whether this phone has Alerts on. Opening Settings sends this phone's
// subscription to the server again, so the two agree even after the server dropped it.
async function showAlerts(
  section: HTMLElement,
  api: ApiClient,
  devicePush: DevicePush,
): Promise<void> {
  const heading = document.createElement("h2");
  heading.textContent = "Alerts";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Alerts");
  const optIn = document.createElement("input");
  optIn.type = "checkbox";
  optIn.disabled = true;
  const optInLabel = document.createElement("label");
  optInLabel.append(optIn, " Alerts on this phone");
  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.textContent = "Send a test Alert";
  testButton.disabled = true;
  section.append(heading, status, optInLabel, testButton);
  if (!devicePush.supported) {
    status.textContent =
      "This browser can't receive Alerts. Install the app from Chrome on the phone.";
    return;
  }
  status.textContent = "Checking Alerts…";

  let publicKey: string;
  try {
    const setup = await api.pushSetup();
    const limits = document.createElement("p");
    limits.setAttribute("aria-label", "Alert limits");
    limits.textContent = `No Alerts from ${setup.quietHours.start} to ${setup.quietHours.end}, and at most ${String(setup.dailyCap)} a day. Alerts held back by these are dropped; the Items stay in the Inbox.`;
    status.after(limits);
    if (setup.publicKey === null) {
      status.textContent = "Alerts aren't set up on the server yet.";
      return;
    }
    publicKey = setup.publicKey;
    let current = await devicePush.current();
    // Made with a VAPID key the server no longer has: the push service would refuse every
    // Alert to it, so drop it here and on the server, and let the owner turn Alerts on again.
    if (
      current &&
      current.serverKey !== null &&
      current.serverKey !== publicKey
    ) {
      await devicePush.unsubscribe();
      await api.unsubscribePush(current.subscription.endpoint);
      current = null;
    }
    if (current) await api.subscribePush(current.subscription);
    optIn.checked = current !== null;
  } catch (error) {
    if (error instanceof SignedOutError) return;
    status.textContent = `Couldn't check Alerts: ${messageOf(error)}`;
    return;
  }
  const settle = (message: string): void => {
    status.textContent = message;
    optIn.disabled = false;
    testButton.disabled = !optIn.checked;
  };
  const onOrOff = (on: boolean): string =>
    `Alerts are ${on ? "on" : "off"} for this phone.`;
  settle(onOrOff(optIn.checked));

  optIn.addEventListener("change", () => {
    const turningOn = optIn.checked;
    optIn.disabled = true;
    testButton.disabled = true;
    status.textContent = turningOn
      ? "Turning Alerts on…"
      : "Turning Alerts off…";
    const change = turningOn
      ? devicePush
          .subscribe(publicKey)
          .then((subscription) => api.subscribePush(subscription))
      : devicePush
          .unsubscribe()
          .then((endpoint) =>
            endpoint === null ? undefined : api.unsubscribePush(endpoint),
          );
    change.then(
      () => {
        settle(onOrOff(turningOn));
      },
      (error: unknown) => {
        if (error instanceof SignedOutError) return;
        optIn.checked = !turningOn;
        settle(
          `Couldn't turn Alerts ${turningOn ? "on" : "off"}: ${messageOf(error)}`,
        );
      },
    );
  });

  testButton.addEventListener("click", () => {
    testButton.disabled = true;
    status.textContent = "Sending a test Alert…";
    api.sendTestAlert().then(
      (report) => {
        settle(describeTestAlert(report));
      },
      (error: unknown) => {
        if (error instanceof SignedOutError) return;
        settle(`Couldn't send a test Alert: ${messageOf(error)}`);
      },
    );
  });
}

function describeTestAlert(report: TestAlertReport): string {
  const parts = [`Test Alert sent to ${phones(report.delivered)}.`];
  if (report.removed > 0) {
    parts.push(
      `${phones(report.removed)} no longer taking Alerts ${report.removed === 1 ? "was" : "were"} forgotten.`,
    );
  }
  if (report.failed > 0) {
    parts.push(
      `${phones(report.failed)} couldn't be reached; try again in a minute.`,
    );
  }
  return parts.join(" ");
}

function phones(count: number): string {
  return count === 1 ? "1 phone" : `${String(count)} phones`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// A warning from 80% of the monthly limit, and a stronger one once Briefings have stopped;
// null below 80%.
export function spendingBanner(summary: SpendingSummary): HTMLElement | null {
  if (summary.status === "ok") return null;
  const banner = document.createElement("p");
  banner.setAttribute("role", "alert");
  banner.setAttribute("aria-label", "Spending");
  banner.textContent =
    summary.status === "warning"
      ? `AI spending is at $${summary.totalUsd} of the $${summary.limitUsd} monthly limit. Briefings stop at the limit.`
      : `AI spending reached the $${summary.limitUsd} monthly limit: Briefings are off until next month. Scoring keeps running.`;
  return banner;
}
