import { describe, expect, it } from "vitest";
import { ART_COLOURS } from "../../../src/adapters/renderer/board-view";
import PAGE from "../../../index.html?raw";

describe("the art kit's colours", () => {
  it.each(Object.entries(ART_COLOURS))(
    "--%s in the page matches its constant",
    (name, colour) => {
      const hex = `#${colour.toString(16).padStart(6, "0")}`;
      expect(PAGE).toContain(`--${name}: ${hex};`);
    },
  );
});
