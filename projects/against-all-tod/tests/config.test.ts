import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";

const validEnv = {
  VITE_BASE_PATH: "./",
  VITE_DEBUG: "false",
  VITE_DEFAULT_SEED: "12345",
};

describe("loadConfig", () => {
  it("reads every setting from valid env vars", () => {
    expect(loadConfig({ ...validEnv, VITE_BUILD_VERSION: "1ae5b74" })).toEqual({
      basePath: "./",
      debug: false,
      defaultSeed: 12345,
      buildVersion: "1ae5b74",
    });
  });

  it("accepts an absolute base path and debug on", () => {
    const config = loadConfig({
      ...validEnv,
      VITE_BASE_PATH: "/ai-projects/against-all-tod/",
      VITE_DEBUG: "true",
    });
    expect(config.basePath).toBe("/ai-projects/against-all-tod/");
    expect(config.debug).toBe(true);
  });

  it("names the build 'dev' when no version is given", () => {
    expect(loadConfig(validEnv).buildVersion).toBe("dev");
    expect(
      loadConfig({ ...validEnv, VITE_BUILD_VERSION: " " }).buildVersion,
    ).toBe("dev");
  });

  it.each(["VITE_BASE_PATH", "VITE_DEBUG", "VITE_DEFAULT_SEED"])(
    "fails with the variable's name when %s is missing",
    (name) => {
      const env = { ...validEnv, [name]: undefined };
      expect(() => loadConfig(env)).toThrow(ConfigError);
      expect(() => loadConfig(env)).toThrow(`${name} is missing`);
    },
  );

  it.each([
    ["VITE_BASE_PATH", "ai-projects/", /VITE_BASE_PATH must be "\.\/" or/],
    ["VITE_BASE_PATH", "/ai-projects", /VITE_BASE_PATH must be "\.\/" or/],
    ["VITE_DEBUG", "yes", /VITE_DEBUG must be "true" or "false", got "yes"/],
    [
      "VITE_DEFAULT_SEED",
      "lucky",
      /VITE_DEFAULT_SEED must be a whole number, got "lucky"/,
    ],
    [
      "VITE_DEFAULT_SEED",
      "2.5",
      /VITE_DEFAULT_SEED must be a whole number, got "2.5"/,
    ],
    [
      "VITE_DEFAULT_SEED",
      "-1",
      /VITE_DEFAULT_SEED must be from 0 to 4294967295, got -1/,
    ],
    [
      "VITE_DEFAULT_SEED",
      "4294967296",
      /VITE_DEFAULT_SEED must be from 0 to 4294967295/,
    ],
  ])("rejects %s=%s", (name, value, message) => {
    const env = { ...validEnv, [name]: value };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
