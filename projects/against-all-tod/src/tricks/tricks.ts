import type { Side } from "../battle/battle";
import { SLIDERS, TRICK_RULES, type SliderId } from "../catalog/tricks";

/**
 * Settings tricks: where each slider stands, what a drag costs and which side it helps. Pure, so
 * the Run, the battle and the Settings menu all read the same rules.
 */

/** Each slider's position, from -2 to 2 with 0 the neutral middle. */
export type SliderPositions = Readonly<Record<SliderId, number>>;

export const NEUTRAL_SLIDERS: SliderPositions = {
  brightness: 0,
  volume: 0,
  "game-speed": 0,
};

/** A slider dragged during a battle: from `step` on, it stands at `position`. */
export interface SliderInput {
  readonly step: number;
  readonly slider: SliderId;
  readonly position: number;
}

/** The side a step in `direction` (-1 down, 1 up) helps. */
export function sideHelped(slider: SliderId, direction: -1 | 1): Side {
  return direction === SLIDERS[slider].attackDirection ? "attack" : "defense";
}

export function isSliderPosition(position: number): boolean {
  return (
    Number.isInteger(position) && Math.abs(position) <= TRICK_RULES.stepsEachWay
  );
}

/**
 * The gold a drag from `from` to `to` costs, step by step: the normal price for each step away
 * from the middle, double for each step back toward it, all doubled mid-battle. Null when `to`
 * is off the slider or no move at all.
 */
export function dragPrice(
  slider: SliderId,
  from: number,
  to: number,
  midBattle: boolean,
): number | null {
  if (!isSliderPosition(from) || !isSliderPosition(to) || from === to) {
    return null;
  }
  const direction = Math.sign(to - from);
  const { stepPrice } = SLIDERS[slider];
  let price = 0;
  for (let at = from; at !== to; at += direction) {
    const towardMiddle = Math.abs(at + direction) < Math.abs(at);
    price += towardMiddle
      ? stepPrice * TRICK_RULES.towardMiddleMultiplier
      : stepPrice;
  }
  return midBattle ? price * TRICK_RULES.midBattleMultiplier : price;
}

/** The positions once every input up to and including `step` has happened. */
export function slidersAt(
  start: SliderPositions,
  inputs: readonly SliderInput[],
  step: number,
): SliderPositions {
  let positions = start;
  for (const input of inputs) {
    if (input.step > step) break;
    positions = { ...positions, [input.slider]: input.position };
  }
  return positions;
}

/** The positions after every input, however late. */
export function slidersAfter(
  start: SliderPositions,
  inputs: readonly SliderInput[],
): SliderPositions {
  return slidersAt(start, inputs, Infinity);
}
