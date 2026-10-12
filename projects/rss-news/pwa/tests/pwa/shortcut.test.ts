import { describe, expect, it } from "vitest";

import manifestText from "../../public/manifest.webmanifest?raw";
import { shortcutInPageUrl } from "../../src/pwa/shortcut";

interface ManifestShortcut {
  name: string;
  url: string;
  icons: { src: string }[];
}

const page = "https://rickphobia.com/ai-projects/rss-news/";

describe("the app icon's shortcuts", () => {
  const manifest = JSON.parse(manifestText) as {
    shortcuts: ManifestShortcut[];
  };

  it("offer Brief me (24h), Chat and Notes, each with an icon", () => {
    expect(manifest.shortcuts.map((shortcut) => shortcut.name)).toEqual([
      "Brief me (24h)",
      "Chat",
      "Notes",
    ]);
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.icons.length).toBeGreaterThan(0);
    }
  });

  it("each open the app on its own screen", () => {
    expect(
      manifest.shortcuts.map((shortcut) =>
        shortcutInPageUrl(new URL(shortcut.url, page).href),
      ),
    ).toEqual(["brief", "chat", "notes"]);
  });

  it("ignore a page address without a known shortcut", () => {
    expect(shortcutInPageUrl(page)).toBeNull();
    expect(shortcutInPageUrl(`${page}?shortcut=sources`)).toBeNull();
  });
});
