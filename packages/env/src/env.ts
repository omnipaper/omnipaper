import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY must be at least 16 characters"),
    AUTH_SECRET: z.string().min(1),
    // NOTE: when transactional email / OAuth lands, APP_URL becomes required in prod (those links
    // must NOT be built from a spoofable request Host) — add a startup guard then.
    APP_URL: z.url().optional(),
    EXTRA_TRUSTED_ORIGINS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    PORT: z.coerce.number().default(3000),
    SERVICES: z.string().default("web,worker"),
    DEMO_MODE: z
      .string()
      .default("false")
      .transform((v) => v === "true"),
    DEMO_USER_EMAIL: z.email().optional(),
    DEMO_USER_PASSWORD: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
