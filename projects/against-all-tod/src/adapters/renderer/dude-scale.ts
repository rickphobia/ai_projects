import type { DudeKindId } from "../../catalog/dudes";

/** An Intern's drawing is about half a tile wide at this scale, as the old disc was. */
const DUDE_SCALE = 1.4;
/** Balloonists float above the Maze, so they are drawn bigger. */
const FLYER_SCALE = 1.15;
/** A Ram Crew is four Dudes and a ram in one, so it is drawn bigger still. */
const RAM_CREW_SCALE = 1.5;
/** The Landlord is a boss: bigger than any other Dude, even a giant Ram Crew. */
const LANDLORD_SCALE = 2.6;
/** Giant Mutation: a giant is drawn this much bigger, a Split half this much smaller. */
const GIANT_SCALE = 1.6;
const HALF_SCALE = 0.7;

/**
 * How big a Dude is drawn: by kind, then its Mutations (Giant bigger, a Split half smaller). The
 * Landlord comes out bigger than any other kind, giant or not.
 */
export function dudeScale(
  kind: DudeKindId,
  giant: boolean,
  half: boolean,
): number {
  const byKind =
    kind === "balloonist"
      ? FLYER_SCALE
      : kind === "ram-crew"
        ? RAM_CREW_SCALE
        : kind === "landlord"
          ? LANDLORD_SCALE
          : 1;
  return (
    DUDE_SCALE * byKind * (giant ? GIANT_SCALE : 1) * (half ? HALF_SCALE : 1)
  );
}
