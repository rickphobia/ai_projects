/** The Settings menu's sliders. */
export type SliderId = "brightness" | "volume" | "window-size" | "game-speed";

export interface SliderEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: SliderId;
  readonly name: string;
  /** What moving it down and up does, one line each, for the Settings menu. */
  readonly downLabel: string;
  readonly upLabel: string;
  /** Gold for one step away from the middle, in the paying side's own gold. */
  readonly stepPrice: number;
  /** Undo price for each step the slider stands from the middle, paid in Pieces or Dudes. */
  readonly undoStepPrice: number;
  /** The direction that helps the attack: -1 for down, 1 for up. The other helps the defense. */
  readonly attackDirection: -1 | 1;
  /** Whether it can be dragged during a battle, as well as between battles. */
  readonly midBattle: boolean;
}

export const SLIDERS: Readonly<Record<SliderId, SliderEntry>> = {
  brightness: {
    id: "brightness",
    name: "Brightness",
    downLabel: "Darker: towers see less far, except on lit tiles",
    upLabel: "Brighter: Dudes are dazzled and slow down",
    stepPrice: 20,
    undoStepPrice: 20,
    attackDirection: -1,
    midBattle: true,
  },
  volume: {
    id: "volume",
    name: "Volume",
    downLabel: "Quieter: towers can't hear Dudes until they're close",
    upLabel: "Louder: Sirens reach further, Hype Men shout louder",
    stepPrice: 20,
    undoStepPrice: 20,
    attackDirection: -1,
    midBattle: true,
  },
  "window-size": {
    id: "window-size",
    name: "Window size",
    downLabel:
      "Smaller: the Spawn zone closes at top and bottom, Dudes bunch up",
    upLabel:
      "Bigger: an open lane along the top and bottom edges, Pieces on it crushed if it closes",
    stepPrice: 30,
    undoStepPrice: 30,
    attackDirection: 1,
    // It reshapes the Board and moves painted Dudes, which a running battle can't take.
    midBattle: false,
  },
  "game-speed": {
    id: "game-speed",
    name: "Game speed",
    downLabel: "Slower: Dudes slow down, towers get extra shots",
    upLabel: "Faster: Dudes speed up, towers reload slower",
    stepPrice: 25,
    undoStepPrice: 25,
    attackDirection: 1,
    midBattle: true,
  },
};

export const SLIDER_IDS: readonly SliderId[] = [
  "brightness",
  "volume",
  "window-size",
  "game-speed",
];

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
  /**
   * How near, in tiles, a Dude must be before a tower can target it, per Volume step down (the
   * first entry for one step, the second for two). Siren range and Hype Man boost have their own
   * per-step numbers in the Pieces and Dudes catalogs.
   */
  quietSightTiles: [3, 2],
  /** Share of the game's real loudness added per Volume step (taken per step down). */
  loudnessPerVolumeStep: 0.4,
  /** Share of a Dude's speed added per Game speed step (taken per step down). */
  dudeSpeedPerGameStep: 0.2,
  /** Share of a tower's time between shots added per Game speed step (taken per step down). */
  reloadPerGameStep: 0.2,
} as const;
