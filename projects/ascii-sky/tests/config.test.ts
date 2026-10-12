import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";

const validEnv = { VITE_BASE_PATH: "./", VITE_DEBUG: "false" };

describe("loadConfig", () => {
  it("reads the settings from valid env vars", () => {
    expect(loadConfig(validEnv)).toEqual({
      basePath: "./",
      debug: false,
      buildVersion: "dev",
    });
  });

  it("accepts an absolute base path, debug on and a build version", () => {
    const env = {
      VITE_BASE_PATH: "/ai-projects/ascii-sky/",
      VITE_DEBUG: "true",
      VITE_BUILD_VERSION: "1ae5b74",
    };
    expect(loadConfig(env)).toEqual({
      basePath: "/ai-projects/ascii-sky/",
      debug: true,
      buildVersion: "1ae5b74",
    });
  });

  it.each(["VITE_BASE_PATH", "VITE_DEBUG"])(
    "fails with the variable's name when %s is missing",
    (name) => {
      const env = { ...validEnv, [name]: undefined };
      expect(() => loadConfig(env)).toThrow(ConfigError);
      expect(() => loadConfig(env)).toThrow(`${name} is missing`);
    },
  );

  it.each([
    ["VITE_BASE_PATH", "/ai-projects/ascii-sky", /must be "\.\/" or a path/],
    ["VITE_BASE_PATH", "ai-projects/", /must be "\.\/" or a path/],
    ["VITE_DEBUG", "yes", /VITE_DEBUG must be "true" or "false", got "yes"/],
  ])("rejects %s=%s", (name, value, message) => {
    const env = { ...validEnv, [name]: value };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
