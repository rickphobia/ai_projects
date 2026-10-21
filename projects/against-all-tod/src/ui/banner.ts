import type { Side } from "../battle/battle";

/**
 * Ribbon banners for the game's moments: whose turn it is, and whether the battle was won. Each
 * slides across in under a second and a tap skips it, so it never slows a Run down.
 */

/** How long a banner stays, slide in and out included. */
export const BANNER_MS = 900;

export type BannerKind = "defense-turn" | "attack-turn" | "won" | "lost";

/** Starts `run` after `ms`; the returned function cancels it. */
export type Schedule = (run: () => void, ms: number) => () => void;

/** What draws a banner, so the timing can be tested without a page. */
export interface BannerView {
  show(kind: BannerKind): void;
  hide(): void;
  onTap(handler: () => void): void;
}

const BANNER_TEXT: Record<BannerKind, string> = {
  "defense-turn": "DEFENSE TURN!",
  "attack-turn": "ATTACK TURN!",
  won: "ROUND WON!",
  lost: "ROUND LOST!",
};

export function bannerText(kind: BannerKind): string {
  return BANNER_TEXT[kind];
}

export function turnBanner(side: Side): BannerKind {
  return side === "defense" ? "defense-turn" : "attack-turn";
}

/** Shows one banner at a time and runs what comes after it once it ends or is tapped away. */
export class Banner {
  private showing: {
    readonly cancel: () => void;
    readonly then: () => void;
  } | null = null;

  constructor(
    private readonly view: BannerView,
    private readonly schedule: Schedule,
  ) {
    view.onTap(() => {
      this.finish();
    });
  }

  /** A banner already showing finishes first, so what was waiting on it still happens. */
  show(kind: BannerKind, then: () => void = () => undefined): void {
    this.finish();
    this.view.show(kind);
    this.showing = {
      cancel: this.schedule(() => {
        this.finish();
      }, BANNER_MS),
      then,
    };
  }

  private finish(): void {
    const showing = this.showing;
    if (showing === null) return;
    this.showing = null;
    showing.cancel();
    this.view.hide();
    showing.then();
  }
}

/** The banner overlay in the page: a ribbon across the middle; a tap anywhere skips it. */
export class BannerOverlay implements BannerView {
  constructor(private readonly host: HTMLElement) {
    host.style.setProperty("--banner-ms", `${String(BANNER_MS)}ms`);
    host.hidden = true;
  }

  show(kind: BannerKind): void {
    const ribbon = this.host.ownerDocument.createElement("p");
    // A fresh element restarts the slide even when one banner follows another.
    ribbon.className = `banner-ribbon banner-${kind}`;
    ribbon.textContent = bannerText(kind);
    this.host.replaceChildren(ribbon);
    this.host.hidden = false;
  }

  hide(): void {
    this.host.hidden = true;
  }

  onTap(handler: () => void): void {
    // A click, not pointerdown: otherwise the tap's click lands on the report it just opened.
    this.host.addEventListener("click", handler);
  }
}

export function browserSchedule(run: () => void, ms: number): () => void {
  const id = window.setTimeout(run, ms);
  return () => {
    window.clearTimeout(id);
  };
}
