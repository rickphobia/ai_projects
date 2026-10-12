// The app icon's long-press shortcuts (the manifest's "shortcuts") open the app with
// ?shortcut=<name>, naming the screen to start on.
const shortcutParam = "shortcut";
const shortcuts = ["brief", "chat", "notes"] as const;

export type Shortcut = (typeof shortcuts)[number];

export function shortcutInPageUrl(url: string): Shortcut | null {
  const value = new URL(url).searchParams.get(shortcutParam);
  return shortcuts.find((shortcut) => shortcut === value) ?? null;
}
