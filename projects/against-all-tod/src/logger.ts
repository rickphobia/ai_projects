export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Debug when the build's debug flag is on or the page URL has `?debug=1`; otherwise info and above. */
export function chooseLogLevel(debugFlag: boolean, search: string): LogLevel {
  const debugQuery = new URLSearchParams(search).get("debug") === "1";
  return debugFlag || debugQuery ? "debug" : "info";
}

/** Writes to the browser console, dropping messages below `minLevel`. */
export function createConsoleLogger(
  minLevel: LogLevel,
  sink: Console = console,
): Logger {
  const log = (
    level: LogLevel,
    message: string,
    fields: LogFields = {},
  ): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    sink[level](`[against-all-tod] ${level.toUpperCase()} ${message}`, fields);
  };
  return {
    debug: (message, fields) => {
      log("debug", message, fields);
    },
    info: (message, fields) => {
      log("info", message, fields);
    },
    warn: (message, fields) => {
      log("warn", message, fields);
    },
    error: (message, fields) => {
      log("error", message, fields);
    },
  };
}
