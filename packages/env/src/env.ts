import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY must be at least 16 characters"),
    AUTH_SECRET: z.string().min(1),
    // Public origin where omnipaper is reachable. In prod the SPA and API share this one
    // origin; it drives better-auth's baseURL (whose origin is auto-trusted), so it doubles
    // as the primary CORS / trusted origin.
    APP_URL: z.string().min(1).default("http://localhost:3000"),
    // Extra allowed origins beyond APP_URL (comma-separated -> string[]). Needed for
    // cross-origin dev (Vite :5173 calling the API :3000); leave empty in single-origin prod.
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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
