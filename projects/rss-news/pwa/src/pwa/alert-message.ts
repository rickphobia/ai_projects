// An Alert as the push message carries it, and the page that tapping it opens. Only the service
// worker imports this; the app reads the page's Item back with opened-item.ts.

export interface AlertMessage {
  title: string;
  body: string;
  // The Item tapping the Alert opens; null opens the app.
  itemId: number | null;
  // The Briefing it opens instead, for a Briefing written while the app was closed.
  briefingId: number | null;
}

// opened-item.ts reads the same parameter.
const itemParam = "item";

// The message the server sent; anything unreadable still shows, as a plain Alert.
export function alertFromPushData(text: string | null): AlertMessage {
  let data: unknown;
  try {
    data = text === null ? null : JSON.parse(text);
  } catch {
    // Not JSON: show the text itself rather than nothing.
    return {
      title: "rss-news",
      body: text ?? "",
      itemId: null,
      briefingId: null,
    };
  }
  const fields =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  return {
    title: typeof fields.title === "string" ? fields.title : "rss-news",
    body: typeof fields.body === "string" ? fields.body : "",
    itemId: isId(fields.item_id) ? fields.item_id : null,
    briefingId: isId(fields.briefing_id) ? fields.briefing_id : null,
  };
}

// The app at `scope` (the path prefix), opened on the Alert's Item when it has one, or on its
// Briefing (the app's own #briefings/<id> address).
export function alertPageUrl(
  itemId: number | null,
  scope: string,
  briefingId: number | null = null,
): string {
  const url = new URL("./", scope);
  if (itemId !== null) url.searchParams.set(itemParam, String(itemId));
  if (briefingId !== null) url.hash = `briefings/${String(briefingId)}`;
  return url.href;
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
