import { describe, expect, it } from "vitest";
import {
  Banner,
  BANNER_MS,
  bannerText,
  turnBanner,
  type BannerKind,
  type BannerView,
  type Schedule,
} from "../../src/ui/banner";

/** Records what the overlay shows and hands the test its tap. */
class FakeView implements BannerView {
  shown: BannerKind | null = null;
  tap: () => void = () => undefined;
  show(kind: BannerKind): void {
    this.shown = kind;
  }
  hide(): void {
    this.shown = null;
  }
  onTap(handler: () => void): void {
    this.tap = handler;
  }
}

/** A clock the test moves by hand. */
function fakeClock(): { schedule: Schedule; advance: (ms: number) => void } {
  let now = 0;
  let timers: { at: number; run: () => void }[] = [];
  return {
    schedule: (run, ms) => {
      const timer = { at: now + ms, run };
      timers.push(timer);
      return () => {
        timers = timers.filter((other) => other !== timer);
      };
    },
    advance: (ms) => {
      now += ms;
      const due = timers.filter((timer) => timer.at <= now);
      timers = timers.filter((timer) => timer.at > now);
      for (const timer of due) timer.run();
    },
  };
}

function setUp(): {
  view: FakeView;
  banner: Banner;
  advance: (ms: number) => void;
} {
  const view = new FakeView();
  const clock = fakeClock();
  return {
    view,
    banner: new Banner(view, clock.schedule),
    advance: clock.advance,
  };
}

describe("Banner", () => {
  it("shows for under a second, then goes and runs what comes next", () => {
    const { view, banner, advance } = setUp();
    let next = 0;
    banner.show("won", () => (next += 1));
    expect(view.shown).toBe("won");
    advance(BANNER_MS - 1);
    expect(next).toBe(0);
    advance(1);
    expect(view.shown).toBeNull();
    expect(next).toBe(1);
    expect(BANNER_MS).toBeLessThan(1000);
  });

  it("skips on a tap, once", () => {
    const { view, banner, advance } = setUp();
    let next = 0;
    banner.show("lost", () => (next += 1));
    view.tap();
    expect(view.shown).toBeNull();
    expect(next).toBe(1);
    advance(BANNER_MS);
    view.tap();
    expect(next).toBe(1);
  });

  it("finishes the banner showing before a new one takes its place", () => {
    const { view, banner, advance } = setUp();
    const order: string[] = [];
    banner.show("won", () => order.push("report"));
    banner.show("attack-turn", () => order.push("turn"));
    expect(order).toEqual(["report"]);
    expect(view.shown).toBe("attack-turn");
    advance(BANNER_MS);
    expect(order).toEqual(["report", "turn"]);
  });
});

describe("banner words", () => {
  it("names the turn in its side's words", () => {
    expect(bannerText(turnBanner("defense"))).toBe("DEFENSE TURN!");
    expect(bannerText(turnBanner("attack"))).toBe("ATTACK TURN!");
  });

  it("calls the battle's result", () => {
    expect(bannerText("won")).toBe("ROUND WON!");
    expect(bannerText("lost")).toBe("ROUND LOST!");
  });
});
