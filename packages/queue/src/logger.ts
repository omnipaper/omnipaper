import { createLogger } from "@omnipaper/logger";
import { Logger } from "graphile-worker";

export const logger = createLogger("queue");

// graphile-worker uses winston-style level names and its own Logger class
const PINO_LEVEL = {
  error: "error",
  warning: "warn",
  info: "info",
  debug: "debug",
} as const;

export const graphileLogger = new Logger((scope) => (level, message, meta) => {
  logger[PINO_LEVEL[level] ?? "info"]({ ...scope, ...meta }, message);
});
