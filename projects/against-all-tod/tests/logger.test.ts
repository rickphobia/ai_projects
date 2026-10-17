import { describe, expect, it, vi } from "vitest";
import { chooseLogLevel, createConsoleLogger } from "../src/logger";

function fakeConsole() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("chooseLogLevel", () => {
  it("is info by default", () => {
    expect(chooseLogLevel(false, "")).toBe("info");
    expect(chooseLogLevel(false, "?seed=4")).toBe("info");
  });

  it("is debug with ?debug=1 or the build's debug flag", () => {
    expect(chooseLogLevel(false, "?debug=1")).toBe("debug");
    expect(chooseLogLevel(false, "?seed=4&debug=1")).toBe("debug");
    expect(chooseLogLevel(true, "")).toBe("debug");
  });
});

describe("createConsoleLogger", () => {
  it("drops messages below its level and prefixes the rest", () => {
    const sink = fakeConsole();
    const logger = createConsoleLogger("info", sink as unknown as Console);

    logger.debug("hidden");
    logger.info("Round started", { round: 1 });
    logger.error("boom");

    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).toHaveBeenCalledWith(
      "[against-all-tod] INFO Round started",
      { round: 1 },
    );
    expect(sink.error).toHaveBeenCalledWith("[against-all-tod] ERROR boom", {});
  });

  it("writes debug messages at debug level", () => {
    const sink = fakeConsole();
    createConsoleLogger("debug", sink as unknown as Console).debug("detail");
    expect(sink.debug).toHaveBeenCalledWith(
      "[against-all-tod] DEBUG detail",
      {},
    );
  });
});
