import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.url().optional(),
    // The demo flag (VITE_DEMO_MODE) lives in lib/demo-mode.ts, read directly from import.meta.env — NOT here.
    // t3-env validates at runtime, which would defeat the build-time tree-shaking of demo code.
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
