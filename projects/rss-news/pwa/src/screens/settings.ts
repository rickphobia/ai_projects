import {
  SignedOutError,
  type ApiClient,
  type SpendingSummary,
} from "../api/client";
import { showInReadingColumn } from "./reading-column";

// The features the spending page names, in the order it lists them.
const featureNames: Record<string, string> = {
  scoring: "Scoring",
  briefings: "Briefings",
};

// Settings: this month's AI cost by feature against the monthly limit, with the warning
// banner from 80%.
export async function renderSettings(
  root: HTMLElement,
  api: ApiClient,
): Promise<void> {
  const heading = document.createElement("h2");
  heading.textContent = "Spending this month";
  const column = showInReadingColumn(root, "div", heading);
  let summary: SpendingSummary;
  try {
    summary = await api.spending();
  } catch (error) {
    if (error instanceof SignedOutError) return;
    const problem = document.createElement("p");
    problem.setAttribute("role", "alert");
    const detail = error instanceof Error ? error.message : String(error);
    problem.textContent = `Couldn't load spending: ${detail}`;
    column.append(problem);
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
  column.append(...(banner ? [banner] : []), total, features);
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
