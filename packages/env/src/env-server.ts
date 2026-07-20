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
    SERVICES: z
      .string()
      .default("web,worker")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(["web", "worker"])).nonempty()),
    DEMO_MODE: z
      .string()
      .default("false")
      .transform((v) => v === "true"),
    DEMO_USER_EMAIL: z.email().optional(),
    DEMO_USER_PASSWORD: z.string().optional(),
    DEMO_ADMIN_EMAIL: z.email().optional(),
    DEMO_ADMIN_PASSWORD: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_URL: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
