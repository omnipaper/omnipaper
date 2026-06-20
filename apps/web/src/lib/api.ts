import type { AppType } from "@omnipaper/api/app";
import { hc } from "hono/client";
import { DemoReadOnlyError, getDemoMode } from "@/lib/demo-mode";

export const API_URL = import.meta.env.VITE_API_URL ?? window.location.origin;

const MUTATING_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;

// In a read-only demo, reject writes client-side instead of round-tripping to the server's 403 —
// the server stays the real boundary (deny-by-default for any direct call); this just gives the UI
// an instant, on-message rejection. Export is a POST that only reads, so it passes through.
const demoAwareFetch: typeof fetch = (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (getDemoMode() && MUTATING_METHODS.test(method) && !url.endsWith("/documents/export")) {
    return Promise.reject(new DemoReadOnlyError());
  }

  return fetch(input, init);
};

export const api = hc<AppType>(API_URL, {
  init: { credentials: "include" },
  fetch: demoAwareFetch,
}).api;
