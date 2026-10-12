/** Characters from sparse to dense: brighter surfaces get denser characters. */
export const CHARACTER_RAMP = " .:-=+*#%@";

/** The ramp character for a brightness from 0 to 1, mapped linearly. NaN counts as dark. */
export function rampCharacter(brightness: number): string {
  const clamped = Number.isNaN(brightness)
    ? 0
    : Math.min(1, Math.max(0, brightness));
  const index = Math.min(
    CHARACTER_RAMP.length - 1,
    Math.floor(clamped * CHARACTER_RAMP.length),
  );
  return CHARACTER_RAMP.charAt(index);
}
