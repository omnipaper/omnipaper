import type { AppType } from "@omnipaper/api/app";
import { hc } from "hono/client";

const API_URL = import.meta.env.VITE_API_URL ?? window.location.origin;

export const api = hc<AppType>(API_URL, {
  init: { credentials: "include" },
}).api;
