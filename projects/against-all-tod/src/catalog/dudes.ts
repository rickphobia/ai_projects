/**
 * Every Dude kind, with its tuning numbers. Pure data: balancing a Dude kind means changing a
 * number here, and tests read the numbers from here rather than copying them.
 */
export type DudeKindId =
  | "intern"
  | "termite"
  | "ram-crew"
  | "balloonist"
  | "shield-bro"
  | "hype-man"
  | "sapper"
  | "mole"
  | "streaker";

export interface DudeKindEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: DudeKindId;
  readonly name: string;
  /** One line for the info panel. */
  readonly description: string;
  readonly health: number;
  /** Tiles per second. */
  readonly speed: number;
  /** Goal health a Dude of this kind takes when it reaches the Goal. */
  readonly goalDamage: number;
  /** How big it is; the Sniper Nest shoots the biggest Dude in range. */
  readonly size: number;
  readonly squadSize: number;
  /** In Attack gold, for one Squad from the shop. */
  readonly squadPrice: number;
  /** What one Dude is worth in gold, killed or getting through; bigger kinds are worth more. */
  readonly goldValue: number;
  /** Time between one Dude of a Squad entering and the next, so a Squad files in. */
  readonly spawnIntervalSeconds: number;
  /** Flies straight to the Goal over the Maze; only towers that hit air can shoot it. */
  readonly flies: boolean;
  /** Its shield soaks shots for the Dudes behind it; null for no shield. */
  readonly shield: ShieldStats | null;
  /** Speeds up the Dudes around it; null for no aura. */
  readonly hypeAura: HypeAuraStats | null;
  /** Tiles of Maze it can tunnel under, once per battle; 0 for kinds that don't dig. */
  readonly tunnelTiles: number;
  /** Every tower in range shoots it before anything else. */
  readonly drawsFire: boolean;
  /** How it damages Pieces, for Wall-breakers; null for kinds that only walk. */
  readonly wallBreaker: WallBreakerStats | null;
  /** Best Score that Unlocks it; null for kinds every Run starts with. Gating arrives with Unlocks. */
  readonly unlockScore: number | null;
}

export interface ShieldStats {
  /** Damage the shield soaks before it breaks. */
  readonly health: number;
  /** In tiles: a shot at a Dude this close behind the bearer hits the shield instead. */
  readonly radius: number;
}

export interface HypeAuraStats {
  /** In tiles, from the Hype Man. */
  readonly range: number;
  /** Extra speed at neutral Volume, as a fraction: 0.4 is 40% faster. */
  readonly speedBoost: number;
  /** What each Volume step up adds to the boost (and each step down takes off), as a fraction of it. */
  readonly boostPerVolumeStep: number;
}

/**
 * How a Wall-breaker damages the blocking Piece in its way: chewing it a little every step,
 * ramming it once per cooldown, or blowing up itself and the Piece.
 */
export type WallBreakerStats =
  | { readonly attack: "chew"; readonly damagePerSecond: number }
  | {
      readonly attack: "ram";
      /** Piece health taken per hit; more than any Piece has, so one hit destroys it. */
      readonly damage: number;
      readonly cooldownSeconds: number;
      /** The crew splits its health evenly; each carrier down slows the ram by one share. */
      readonly carriers: number;
    }
  | { readonly attack: "blast" };

/**
 * What a blocking Piece costs a Wall-breaker's route, in tiles of walking: through a wall when
 * the way round is longer than this, round it otherwise.
 */
export const WALL_BREAKER_PIECE_COST = 8;

const ORDINARY = {
  flies: false,
  shield: null,
  hypeAura: null,
  tunnelTiles: 0,
  drawsFire: false,
  wallBreaker: null,
  unlockScore: null,
} as const;

export const DUDE_KINDS: Readonly<Record<DudeKindId, DudeKindEntry>> = {
  intern: {
    ...ORDINARY,
    id: "intern",
    name: "Intern",
    description: "Cheap fodder that comes 20 to a Squad.",
    health: 30,
    speed: 1.6,
    goalDamage: 5,
    size: 1,
    squadSize: 20,
    squadPrice: 20,
    goldValue: 1,
    spawnIntervalSeconds: 0.25,
  },
  termite: {
    ...ORDINARY,
    id: "termite",
    name: "Termite",
    description: "Slowly chews through a wall so the others can follow.",
    health: 25,
    speed: 1.4,
    goalDamage: 3,
    size: 1,
    squadSize: 10,
    squadPrice: 30,
    goldValue: 1,
    spawnIntervalSeconds: 0.3,
    wallBreaker: { attack: "chew", damagePerSecond: 4 },
  },
  "ram-crew": {
    ...ORDINARY,
    id: "ram-crew",
    name: "Ram Crew",
    description:
      "Four carry a ram that smashes a wall or tower in one hit. Slower as carriers fall.",
    health: 240,
    speed: 1,
    goalDamage: 20,
    size: 4,
    squadSize: 1,
    squadPrice: 60,
    goldValue: 8,
    spawnIntervalSeconds: 1,
    wallBreaker: {
      attack: "ram",
      damage: 1000,
      cooldownSeconds: 3,
      carriers: 4,
    },
  },
  balloonist: {
    ...ORDINARY,
    id: "balloonist",
    name: "Balloonist",
    description: "Floats straight over the Maze. Only some towers can hit it.",
    health: 60,
    speed: 0.8,
    goalDamage: 8,
    size: 2,
    squadSize: 5,
    squadPrice: 35,
    goldValue: 3,
    spawnIntervalSeconds: 0.8,
    flies: true,
  },
  "shield-bro": {
    ...ORDINARY,
    id: "shield-bro",
    name: "Shield Bro",
    description:
      "His shield blocks shots for the Dudes behind him until it breaks.",
    health: 120,
    speed: 1.2,
    goalDamage: 10,
    size: 3,
    squadSize: 3,
    squadPrice: 40,
    goldValue: 5,
    spawnIntervalSeconds: 1,
    shield: { health: 200, radius: 1.5 },
  },
  "hype-man": {
    ...ORDINARY,
    id: "hype-man",
    name: "Hype Man",
    description: "Speeds up the Dudes around him. Louder means faster.",
    health: 70,
    speed: 1.4,
    goalDamage: 5,
    size: 2,
    squadSize: 3,
    squadPrice: 35,
    goldValue: 3,
    spawnIntervalSeconds: 1,
    hypeAura: { range: 2, speedBoost: 0.4, boostPerVolumeStep: 0.25 },
  },
  sapper: {
    ...ORDINARY,
    id: "sapper",
    name: "Sapper",
    description: "Runs to the nearest wall and blows up himself and the wall.",
    health: 45,
    speed: 2,
    goalDamage: 5,
    size: 1,
    squadSize: 3,
    squadPrice: 45,
    goldValue: 2,
    spawnIntervalSeconds: 0.7,
    wallBreaker: { attack: "blast" },
    unlockScore: 5,
  },
  mole: {
    ...ORDINARY,
    id: "mole",
    name: "Mole",
    description: "Tunnels under 3 tiles of Maze once per battle.",
    health: 50,
    speed: 1.3,
    goalDamage: 6,
    size: 1,
    squadSize: 8,
    squadPrice: 35,
    goldValue: 2,
    spawnIntervalSeconds: 0.5,
    tunnelTiles: 3,
    unlockScore: 15,
  },
  streaker: {
    ...ORDINARY,
    id: "streaker",
    name: "Streaker",
    description: "Every tower in range turns to shoot him first.",
    health: 40,
    speed: 2.2,
    goalDamage: 2,
    size: 1,
    squadSize: 4,
    squadPrice: 25,
    goldValue: 1,
    spawnIntervalSeconds: 0.6,
    drawsFire: true,
    unlockScore: 25,
  },
};

/** The small game-made Army of Round 1, before the player has attacked: one Squad per Spawn line row. */
export const ROUND_ONE_ARMY: readonly {
  readonly dudeKind: DudeKindId;
  readonly spawnRow: number;
}[] = [
  { dudeKind: "intern", spawnRow: 3 },
  { dudeKind: "intern", spawnRow: 10 },
];
