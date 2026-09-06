type Level = "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = { level, message, ...meta, ts: new Date().toISOString() };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));

  // Wire up a real error monitor here once you have one, e.g.:
  // if (level === "error" && process.env.SENTRY_DSN) Sentry.captureMessage(message, { extra: meta });
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
