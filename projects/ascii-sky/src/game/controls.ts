/** Everything the player can ask the Plane or the game to do. Which key does what is the keyboard adapter's business. */
export type Action =
  | "pitchUp"
  | "pitchDown"
  | "rollLeft"
  | "rollRight"
  | "rudderLeft"
  | "rudderRight"
  | "throttleUp"
  | "throttleDown"
  | "flapsStep"
  | "brakes"
  | "pause"
  | "restart"
  | "start";

/** The actions held down this moment. */
export type Controls = ReadonlySet<Action>;

export const NO_CONTROLS: Controls = new Set();
