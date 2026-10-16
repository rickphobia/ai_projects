import { routeFromHash, routeHash, type Route } from "./routes";

// What the browser keeps with each history entry, beside the address.
interface Entry {
  // How many entries this app pushed before this one; at 0 there is no screen of ours to go
  // back to, so a back button goes to a fallback instead of leaving the app.
  depth: number;
  // Where the page was scrolled to when the owner left it, restored on Back.
  scrollY: number;
  // The address of the screen this one was opened from, for its back button's label.
  from: string | null;
  // Items picked with "Brief these", which the home screen offers to brief.
  pickedItemIds?: number[];
  // The Inbox list an Item was opened from, in order, so the Item view can move along it.
  listedIds?: number[];
}

// One screen to show, with what its history entry remembers.
export interface Visit {
  route: Route;
  from: Route | null;
  pickedItemIds?: number[];
  listedIds?: number[];
}

export interface GoOptions<Once> {
  pickedItemIds?: number[];
  listedIds?: number[];
  // Passed to this showing only, never replayed by Back or Forward: a quote for the Chat, say.
  once?: Once;
}

// The browser's history for the app's screens: going to a screen adds an entry with its
// address, and Back and Forward (the browser's, a phone's back gesture, or a back button
// here) show the screen of that entry again, scrolled to where the owner left it.
export class Navigation<Once> {
  private entry: Entry = { depth: 0, scrollY: 0, from: null };
  private readonly onPopState = (event: PopStateEvent): void => {
    if (!this.isShown()) {
      window.removeEventListener("popstate", this.onPopState);
      return;
    }
    this.entry = entryOf(event.state);
    const { scrollY } = this.entry;
    void this.show(this.visit(), undefined).then(() => {
      window.scrollTo(0, scrollY);
    });
  };

  constructor(
    private readonly show: (
      visit: Visit,
      once: Once | undefined,
    ) => Promise<void>,
    // False once the shell has been replaced, by login say; its history listener then stops.
    private readonly isShown: () => boolean,
  ) {}

  // Shows the first screen and starts following Back and Forward. A reload keeps the entry
  // the browser already had, so Back still works after it.
  start(route: Route, once?: Once): Promise<void> {
    const kept = entryOf(history.state as unknown);
    const sameScreen = location.hash === routeHash(route);
    this.entry = sameScreen ? kept : { depth: 0, scrollY: 0, from: null };
    history.replaceState(this.entry, "", routeHash(route));
    // The browser would restore the scroll before the screen is drawn again; this does it after.
    history.scrollRestoration = "manual";
    window.addEventListener("popstate", this.onPopState);
    return this.show(this.visit(), once);
  }

  go(
    route: Route,
    { pickedItemIds, listedIds, once }: GoOptions<Once> = {},
  ): Promise<void> {
    history.replaceState({ ...this.entry, scrollY: window.scrollY }, "");
    this.entry = {
      depth: this.entry.depth + 1,
      scrollY: 0,
      from: location.hash,
      ...(pickedItemIds === undefined ? {} : { pickedItemIds }),
      ...(listedIds === undefined ? {} : { listedIds }),
    };
    history.pushState(this.entry, "", routeHash(route));
    window.scrollTo(0, 0);
    return this.show(this.visit(), once);
  }

  // Another screen in this entry's place, keeping where it came from and what it remembers:
  // moving to the next Item, so Back still goes to the Inbox rather than through each Item.
  replace(route: Route): Promise<void> {
    this.entry = { ...this.entry, scrollY: 0 };
    history.replaceState(this.entry, "", routeHash(route));
    window.scrollTo(0, 0);
    return this.show(this.visit(), undefined);
  }

  // A back button: the browser's Back while there is a screen of ours behind this one,
  // otherwise `fallback` in place of this entry, so Back from there doesn't return here.
  back(fallback: Route): void {
    if (this.entry.depth > 0) {
      history.back();
      return;
    }
    this.entry = { depth: 0, scrollY: 0, from: null };
    history.replaceState(this.entry, "", routeHash(fallback));
    void this.show(this.visit(), undefined);
  }

  // The screen being shown, with what its history entry remembers.
  visit(): Visit {
    return {
      route: routeFromHash(location.hash),
      from: this.entry.from === null ? null : routeFromHash(this.entry.from),
      ...(this.entry.pickedItemIds === undefined
        ? {}
        : { pickedItemIds: this.entry.pickedItemIds }),
      ...(this.entry.listedIds === undefined
        ? {}
        : { listedIds: this.entry.listedIds }),
    };
  }
}

// History state comes back from the browser untyped, and may be another page's or none.
function entryOf(state: unknown): Entry {
  if (typeof state !== "object" || state === null) {
    return { depth: 0, scrollY: 0, from: null };
  }
  const { depth, scrollY, from, pickedItemIds, listedIds } = state as Record<
    string,
    unknown
  >;
  return {
    depth: typeof depth === "number" ? depth : 0,
    scrollY: typeof scrollY === "number" ? scrollY : 0,
    from: typeof from === "string" ? from : null,
    ...(isIdList(pickedItemIds) ? { pickedItemIds } : {}),
    ...(isIdList(listedIds) ? { listedIds } : {}),
  };
}

function isIdList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => typeof id === "number");
}
