import type { SliderId } from "../catalog/tricks";

// Inline SVG so the icons need no asset files and share the cartoon outline. Each is drawn in a
// 24×24 viewBox.
const OUTLINE = `stroke="#2a2118" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const SUN = `<circle cx="12" cy="12" r="5" fill="#ffd23f" ${OUTLINE}/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" fill="none" ${OUTLINE}/>`;
const SPEAKER = `<path d="M3 9h4l5-4v14l-5-4H3z" fill="#ece6d9" ${OUTLINE}/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" ${OUTLINE}/>`;
const WINDOW = `<rect x="2.5" y="4" width="19" height="16" rx="2" fill="#8fd3ff" ${OUTLINE}/><path d="M2.5 8.5h19" fill="none" ${OUTLINE}/><circle cx="5.5" cy="6.3" r="0.8" fill="#2a2118"/><circle cx="8" cy="6.3" r="0.8" fill="#2a2118"/>`;
const TURTLE = `<ellipse cx="19.5" cy="15" rx="2.5" ry="2" fill="#7cc46a" ${OUTLINE}/><path d="M4 17a8 7 0 0 1 14 0z" fill="#3e8c3a" ${OUTLINE}/><path d="M6 17v2.5M15 17v2.5" fill="none" ${OUTLINE}/><path d="M8 13l3-2 3 2" fill="none" ${OUTLINE}/>`;
const RABBIT = `<path d="M9 9C8 4 8.5 1.5 10 2s1.5 4 1 7M13 9c1-4 2.5-6 3.5-5s-.5 4-2 6" fill="#fffaf0" ${OUTLINE}/><ellipse cx="12" cy="15" rx="7" ry="5.5" fill="#fffaf0" ${OUTLINE}/><circle cx="14.5" cy="13.5" r="0.9" fill="#2a2118"/>`;

export const SKULL_ICON = `<path d="M12 2.5a8 8 0 0 0-8 8c0 3 1.5 4.8 3 5.6V20h10v-3.9c1.5-.8 3-2.6 3-5.6a8 8 0 0 0-8-8z" fill="#fffaf0" ${OUTLINE}/><circle cx="9" cy="11" r="1.8" fill="#2a2118"/><circle cx="15" cy="11" r="1.8" fill="#2a2118"/><path d="M10 20v-2.5M14 20v-2.5" fill="none" ${OUTLINE}/>`;
export const COIN_ICON = `<circle cx="12" cy="12" r="9" fill="#ffd23f" ${OUTLINE}/><circle cx="12" cy="12" r="5" fill="none" stroke="#c98b4e" stroke-width="2"/>`;

/** The icon at each end of a trick's slider: the same picture both ends, except Game speed. */
export const TRICK_ICONS: Readonly<
  Record<SliderId, { readonly down: string; readonly up: string }>
> = {
  brightness: { down: SUN, up: SUN },
  volume: { down: SPEAKER, up: SPEAKER },
  "window-size": { down: WINDOW, up: WINDOW },
  "game-speed": { down: TURTLE, up: RABBIT },
};

/** An `<svg>` for one of the icons above, hidden from screen readers. */
export function iconElement(doc: Document, paths: string): SVGSVGElement {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  svg.innerHTML = paths;
  return svg;
}
