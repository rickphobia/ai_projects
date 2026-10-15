// Every screen's address after the #, so the browser's Back and Forward, a reload and a bookmark
// all land on the right screen. Under /ai-projects/rss-news/ only the part after # is the app's.
export type Route =
  | { screen: "home" }
  | { screen: "inbox"; folderId?: number }
  | { screen: "item"; itemId: number }
  | { screen: "briefings" }
  | { screen: "briefing"; briefingId: number }
  | { screen: "notes" }
  | { screen: "note-briefing"; briefingId: number }
  | { screen: "sources" }
  | { screen: "stocks" }
  | { screen: "settings" };

const HOME: Route = { screen: "home" };

export function routeHash(route: Route): string {
  switch (route.screen) {
    case "inbox":
      return route.folderId === undefined
        ? "#inbox"
        : `#inbox/folder/${String(route.folderId)}`;
    case "item":
      return `#items/${String(route.itemId)}`;
    case "briefing":
      return `#briefings/${String(route.briefingId)}`;
    case "note-briefing":
      return `#notes/briefing/${String(route.briefingId)}`;
    default:
      return `#${route.screen}`;
  }
}

// An address the app doesn't know, or none at all, is Home.
export function routeFromHash(hash: string): Route {
  const parts = hash.replace(/^#/, "").split("/");
  const [first, second, third] = parts;
  const id = (text: string | undefined): number | null => {
    const value = Number(text);
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  if (parts.length === 1) {
    switch (first) {
      case "inbox":
      case "briefings":
      case "notes":
      case "sources":
      case "stocks":
      case "settings":
        return { screen: first };
      default:
        return HOME;
    }
  }
  if (parts.length === 2) {
    const found = id(second);
    if (found === null) return HOME;
    if (first === "items") return { screen: "item", itemId: found };
    if (first === "briefings") return { screen: "briefing", briefingId: found };
    return HOME;
  }
  const found = id(third);
  if (parts.length !== 3 || found === null) return HOME;
  if (first === "inbox" && second === "folder") {
    return { screen: "inbox", folderId: found };
  }
  if (first === "notes" && second === "briefing") {
    return { screen: "note-briefing", briefingId: found };
  }
  return HOME;
}

// The label of an Item's back button, after the screen it was opened from. Opened straight
// from an Alert or a bookmark, it goes Home.
export function backLabel(from: Route | null): string {
  switch (from?.screen) {
    case undefined:
    case "home":
      return "Back to Home";
    case "inbox":
      return "Back to Inbox";
    case "briefings":
    case "briefing":
      return "Back to Briefings";
    case "notes":
    case "note-briefing":
      return "Back to Notes";
    default:
      return "Back";
  }
}
