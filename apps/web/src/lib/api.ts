import type { AppType } from "@omnipaper/api/app";
import { hc } from "hono/client";
import { DEMO_MODE, withDemoGuard } from "@/lib/demo-mode";
import { env } from "@/lib/env-client";

export const API_URL = env.VITE_API_URL ?? window.location.origin;

export const api = hc<AppType>(API_URL, {
  init: { credentials: "include" },
  fetch: DEMO_MODE ? withDemoGuard(fetch) : fetch,
}).api;
