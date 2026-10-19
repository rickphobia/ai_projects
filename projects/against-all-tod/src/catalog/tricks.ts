/** The Settings menu's sliders. Volume and Window size join with their own tickets. */
export type SliderId = "brightness" | "game-speed";

export interface SliderEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: SliderId;
  readonly name: string;
  /** What moving it down and up does, one line each, for the Settings menu. */
  readonly downLabel: string;
  readonly upLabel: string;
  /** Gold for one step away from the middle, in the paying side's own gold. */
  readonly stepPrice: number;
  /** The direction that helps the attack: -1 for down, 1 for up. The other helps the defense. */
  readonly attackDirection: -1 | 1;
}

export const SLIDERS: Readonly<Record<SliderId, SliderEntry>> = {
  brightness: {
    id: "brightness",
    name: "Brightness",
    downLabel: "Darker: towers see less far, except on lit tiles",
    upLabel: "Brighter: Dudes are dazzled and slow down",
    stepPrice: 20,
    attackDirection: -1,
  },
  "game-speed": {
    id: "game-speed",
    name: "Game speed",
    downLabel: "Slower: Dudes slow down, towers get extra shots",
    upLabel: "Faster: Dudes outrun the towers' turning and reloading",
    stepPrice: 25,
    attackDirection: 1,
  },
};

export const SLIDER_IDS: readonly SliderId[] = ["brightness", "game-speed"];

/** The tuning numbers for every slider's price and battle effect. */
export const TRICK_RULES = {
  /** Steps each way from the neutral middle (0). */
  stepsEachWay: 2,
  /** A step back toward the middle costs this many times the normal price. */
  towardMiddleMultiplier: 2,
  /** A drag during a battle costs this many times its price between battles. */
  midBattleMultiplier: 2,
  /** Share of a tower's range lost per Brightness step down, unless it stands on a lit tile. */
  rangeLossPerDarkStep: 0.25,
  /** Share of a Dude's speed lost per Brightness step up. */
  slowPerBrightStep: 0.15,
  /** Share of a Dude's speed added per Game speed step (taken per step down). */
  dudeSpeedPerGameStep: 0.2,
  /** Share of a tower's time between shots added per Game speed step (taken per step down). */
  reloadPerGameStep: 0.2,
} as const;
