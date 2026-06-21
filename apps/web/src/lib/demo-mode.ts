/*
  DEMO_MODE is a BUILD-TIME constant read straight from import.meta.env (NOT via lib/env-client,
  which validates at runtime) so the bundler can fold the literal and tree-shake every demo-only branch
  out of normal builds — self-hosters ship no demo code.
*/
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const MUTATING_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;

export class DemoReadOnlyError extends Error {
  constructor() {
    super("This is a read-only demo — your changes weren't saved.");
    this.name = "DemoReadOnlyError";
  }
}

// Client-side fetch wrapper that instantly rejects mutating requests in demo mode (except export), only active when DEMO_MODE is true.
export function withDemoGuard(baseFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (MUTATING_METHODS.test(method) && !url.endsWith("/documents/export")) {
      return Promise.reject(new DemoReadOnlyError());
    }
    return baseFetch(input, init);
  };
}
