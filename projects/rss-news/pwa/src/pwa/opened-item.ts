// The Item a tapped Alert's page should open. The service worker builds that page with
// alertPageUrl in alert-message.ts; it can't share this module with the app (see
// service-worker.ts), so the parameter name is written in both.
const itemParam = "item";

export function itemIdInPageUrl(url: string): number | null {
  const value = Number(new URL(url).searchParams.get(itemParam));
  return Number.isInteger(value) && value > 0 ? value : null;
}
