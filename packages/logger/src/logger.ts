import { env } from "@omnipaper/env";
import pino from "pino";
import { getLogContext } from "./context";

const base = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  mixin: getLogContext,
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      "apiKey",
      "password",
      "secret",
      "token",
      "*.apiKey",
      "*.password",
      "*.secret",
      "*.token",
    ],
    censor: "[redacted]",
  },
});

export type Logger = pino.Logger;

export function createLogger(namespace: string): Logger {
  return base.child({ namespace });
}
