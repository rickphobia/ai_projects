// An Alert as the push message carries it, and the page that tapping it opens. Only the service
// worker imports this; the app reads the page's Item back with opened-item.ts.

export interface AlertMessage {
  title: string;
  body: string;
  // The Item tapping the Alert opens; null opens the app.
  itemId: number | null;
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
    return { title: "rss-news", body: text ?? "", itemId: null };
  }
  const fields =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  return {
    title: typeof fields.title === "string" ? fields.title : "rss-news",
    body: typeof fields.body === "string" ? fields.body : "",
    itemId: isItemId(fields.item_id) ? fields.item_id : null,
  };
}

// The app at `scope` (the path prefix), opened on the Alert's Item when it has one.
export function alertPageUrl(itemId: number | null, scope: string): string {
  const url = new URL("./", scope);
  if (itemId !== null) url.searchParams.set(itemParam, String(itemId));
  return url.href;
}

function isItemId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
