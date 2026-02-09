import pino from "pino";

let _logger: pino.Logger | null = null;

function createLogger(): pino.Logger {
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  return pino({
    level: isTest ? "silent" : process.env.LOG_LEVEL || "info",
    transport: isProduction
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      env: process.env.NODE_ENV || "development",
    },
  });
}

export const logger: pino.Logger = new Proxy({} as pino.Logger, {
  get(_target, prop) {
    if (!_logger) {
      _logger = createLogger();
    }
    const value = (_logger as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_logger);
    }
    return value;
  },
});

export function initLogger(): void {
  _logger = createLogger();
}

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export type Logger = pino.Logger;
