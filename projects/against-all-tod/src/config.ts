/**
 * Settings read once at start-up. Vite bakes `VITE_*` env vars into the build, and
 * vite.config.ts reads the same settings so a bad value fails the build, not the page.
 */
export interface Config {
  /** Where the site is served from: `./` (any folder) or an absolute path like `/ai-projects/against-all-tod/`. */
  basePath: string;
  /** Logs at debug level instead of info. */
  debug: boolean;
  /** Seed for a new Run when the URL gives none. */
  defaultSeed: number;
  /** Names the build in the start-up log, e.g. a commit hash. `dev` when not set. */
  buildVersion: string;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

type Env = Readonly<Record<string, string | undefined>>;

const MAX_SEED = 2 ** 32 - 1;

export function loadConfig(env: Env): Config {
  return {
    basePath: readBasePath(env, "VITE_BASE_PATH"),
    debug: readBoolean(env, "VITE_DEBUG"),
    defaultSeed: readInteger(env, "VITE_DEFAULT_SEED", 0, MAX_SEED),
    buildVersion: readOptional(env, "VITE_BUILD_VERSION") ?? "dev",
  };
}

function readOptional(env: Env, name: string): string | undefined {
  const raw = env[name]?.trim();
  return raw === "" ? undefined : raw;
}

function readRequired(env: Env, name: string): string {
  const raw = readOptional(env, name);
  if (raw === undefined) {
    throw new ConfigError(
      `${name} is missing. Copy .env.example to .env and set it.`,
    );
  }
  return raw;
}

function readBasePath(env: Env, name: string): string {
  const raw = readRequired(env, name);
  // Vite joins asset names straight onto the base, so it must end in a slash.
  if (raw !== "./" && !/^\/([\w.-]+\/)*$/.test(raw)) {
    throw new ConfigError(
      `${name} must be "./" or a path that starts and ends with "/", got "${raw}".`,
    );
  }
  return raw;
}

function readBoolean(env: Env, name: string): boolean {
  const raw = readRequired(env, name);
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ConfigError(`${name} must be "true" or "false", got "${raw}".`);
}

function readInteger(env: Env, name: string, min: number, max: number): number {
  const raw = readRequired(env, name);
  // Number("") is 0 and Number("1e3") is 1000, so check the text, not just the parsed value.
  if (!/^-?\d+$/.test(raw)) {
    throw new ConfigError(`${name} must be a whole number, got "${raw}".`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new ConfigError(
      `${name} must be from ${String(min)} to ${String(max)}, got ${raw}.`,
    );
  }
  return value;
}
