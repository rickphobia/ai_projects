import { describe, expect, it } from "vitest";
import { type Action, NO_CONTROLS } from "../../src/game/controls";
import {
  advance,
  type GameState,
  newGame,
  pauseGame,
} from "../../src/game/game";

const FRAME = 1 / 60;

function holding(...actions: Action[]): Set<Action> {
  return new Set(actions);
}

function flying(): GameState {
  return advance(newGame(), holding("start"), FRAME);
}

describe("advance", () => {
  it("opens on the title screen and stays there until a key is pressed", () => {
    expect(newGame().phase).toBe("title");
    expect(advance(newGame(), NO_CONTROLS, FRAME).phase).toBe("title");
  });

  it("leaves the title screen on any key", () => {
    expect(flying().phase).toBe("flying");
  });

  it("toggles pause each time the pause key is pressed", () => {
    let state = advance(flying(), holding("pause"), FRAME);
    expect(state.phase).toBe("paused");
    state = advance(state, NO_CONTROLS, FRAME);
    expect(state.phase).toBe("paused");
    state = advance(state, holding("pause"), FRAME);
    expect(state.phase).toBe("flying");
  });

  it("toggles pause only once while the key is held", () => {
    let state = flying();
    for (let frame = 0; frame < 30; frame++) {
      state = advance(state, holding("pause"), FRAME);
    }
    expect(state.phase).toBe("paused");
  });
});

describe("pauseGame", () => {
  it("pauses a Flight but leaves the title screen alone", () => {
    expect(pauseGame(flying()).phase).toBe("paused");
    expect(pauseGame(newGame()).phase).toBe("title");
  });
});
