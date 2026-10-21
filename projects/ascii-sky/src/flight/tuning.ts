const DEGREES = Math.PI / 180;

/**
 * Every number that sets how the Plane flies, in one place so the feel can be tuned on the
 * preview without touching the flight model. SI units: metres, seconds, kilograms, newtons,
 * radians. Roughly a Cessna 172, softened where that makes it more forgiving.
 */
export const TUNING = {
  /** Advance runs the flight model in steps this long, whatever the frame length. */
  stepSeconds: 1 / 120,
  /** A longer frame (the tab was frozen, say) only counts this much, so one frame can't run for ever. */
  maxFrameSeconds: 0.25,

  mass: 1_000,
  gravity: 9.81,
  airDensity: 1.225,
  wingArea: 16.2,

  /** Lift coefficient with the nose on the airflow, how it grows with angle of attack, and its floor. */
  liftAtZeroAngle: 0.3,
  liftPerRadian: 5,
  minLift: -1,
  /** Past this angle of attack the wing Stalls: about where a C172's does. */
  criticalAngleOfAttack: 15 * DEGREES,
  /** A Stalled wing makes this share of its lift, and flies again only this far below the critical angle. */
  stalledLiftShare: 0.6,
  stallRecoveryMargin: 3 * DEGREES,
  /** While Stalled, the nose drops at this rate whatever the elevator does, until the wing flies again. */
  stallNoseDropRate: 0.4,
  /** Drag coefficient: a fixed part, plus this times the lift coefficient squared. */
  parasiteDrag: 0.032,
  inducedDrag: 0.055,

  /** The flap settings `F` steps through, then back up: a C172's 0, 10, 20 and 30 degrees. */
  flapSettings: [0, 10 * DEGREES, 20 * DEGREES, 30 * DEGREES],
  /** Lift and drag coefficient added per radian of flap: full flaps take the Stall speed from about 48 to 42 knots. */
  flapLiftPerRadian: 0.95,
  flapDragPerRadian: 0.1,
  /** How hard the fuselage pushes back against sideslip, per radian of it. */
  sideForce: 1,

  /** Thrust at full throttle standing still, falling to nothing at the prop's top speed. */
  staticThrust: 3_000,
  thrustFadeSpeed: 100,
  /** How fast holding W or S moves the throttle, in full travel per second. */
  throttleRate: 0.5,

  /** At this airspeed the controls have full effect; slower they are softer, faster a little firmer. */
  controlSpeed: 40,
  maxControlAuthority: 1.5,
  /** How quickly the Plane's turning rates follow the controls: the damping that keeps it smooth. */
  rateResponseSeconds: 0.3,
  /** Turning rates with a control held fully, at full authority. */
  pitchRate: 0.35,
  rollRate: 0.5,
  rudderRate: 0.3,
  /** With the elevator let go, the nose settles to this angle of attack: trimmed for about 75 knots. */
  trimAngleOfAttack: 4.4 * DEGREES,
  pitchStability: 2,
  /** How firmly the nose leans against the flight path curving up or down, so climbs and dives settle. */
  pathDamping: 3,
  /** How fast the wings drift back toward level with the arrows let go, per radian of bank. */
  bankStability: 0.15,
  /** How firmly the nose swings back into the airflow when the Plane sideslips. */
  yawStability: 3,
  /** The Plane can't point straight up or down: the attitude maths breaks there. */
  maxPitch: 85 * DEGREES,

  /** Friction on the wheels, as a share of the weight on them: rolling, and with the brakes on. */
  rollingFriction: 0.02,
  brakeFriction: 0.5,
  /** Nosewheel steering: turning rate per m/s of ground speed with full rudder, up to a limit. */
  groundSteerPerSpeed: 0.11,
  maxGroundSteerRate: 0.6,
  /** Below flying speed the nose sinks back onto its wheel at this rate. */
  noseSettleRate: 0.3,
  /** On the wheels the nose can rise this far before the tail hits the ground. */
  maxGroundPitch: 12 * DEGREES,
  /** Slower than this on the ground counts as standing still. */
  stoppedSpeed: 0.05,

  /** A Touchdown is gentle under this sink rate and bank, with the nose not below level; anything else is a crash. */
  maxGentleSinkRate: 3,
  maxGentleBank: 10 * DEGREES,

  /** The Plane stops this far inside the World's edge. */
  edgeMargin: 50,
  /** The Plane waits this far in from the Runway's start, so it isn't parked on the grass. */
  startDistance: 60,
  /** A Cessna 172 pilot's eye is about this high above the ground. */
  eyeHeight: 2,
} as const;
