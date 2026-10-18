/** How often the reading changes: often enough to follow, slow enough to read. */
const WINDOW_MS = 500;

export interface FpsReading {
  /** Frames per second over the last window. */
  readonly fps: number;
  /** The lowest window since the meter started, so a stutter is not missed between glances. */
  readonly lowestFps: number;
}

/** Counts frames in half-second windows. Pure, so it is tested without a browser. */
export class FpsCounter {
  private frames = 0;
  private windowMs = 0;
  private lowestFps = Infinity;

  /** Records one frame; returns a new reading when a window closes, otherwise null. */
  frame(elapsedMs: number): FpsReading | null {
    this.frames++;
    this.windowMs += elapsedMs;
    if (this.windowMs < WINDOW_MS) return null;
    const fps = (this.frames * 1000) / this.windowMs;
    this.lowestFps = Math.min(this.lowestFps, fps);
    this.frames = 0;
    this.windowMs = 0;
    return { fps, lowestFps: this.lowestFps };
  }
}

/** "58 fps (lowest 51) · 456 Dudes" */
export function fpsText(reading: FpsReading, dudesOnBoard: number): string {
  return `${reading.fps.toFixed(0)} fps (lowest ${reading.lowestFps.toFixed(0)}) · ${String(dudesOnBoard)} Dudes`;
}

/** The debug fps reading in a corner of the page. */
export class FpsMeter {
  private readonly counter = new FpsCounter();

  constructor(private readonly host: HTMLElement) {
    host.hidden = false;
  }

  /** Records a frame, with how many Dudes it drew, since frame rate depends on it. */
  frame(elapsedMs: number, dudesOnBoard: number): void {
    const reading = this.counter.frame(elapsedMs);
    if (reading !== null) {
      this.host.textContent = fpsText(reading, dudesOnBoard);
    }
  }
}
