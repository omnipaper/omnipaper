import { useSyncExternalStore } from "react";

// Read straight from import.meta.env (not lib/env-client) so the bundler folds the literal and
// tree-shakes demo-only branches out of self-hosted builds.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const MUTATING_METHODS = /^(POST|PUT|PATCH|DELETE)$/i;

// Flipped when the server confirms the session belongs to the demo curator (syncDemoAccess);
// purely cosmetic — the API independently re-checks every write.
let demoWritable = false;
const listeners = new Set<() => void>();

export function setDemoWritable(value: boolean): void {
  if (demoWritable === value) {
    return;
  }

  demoWritable = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDemoReadOnly(): boolean {
  return DEMO_MODE && !demoWritable;
}

export function useDemoReadOnly(): boolean {
  return useSyncExternalStore(subscribe, isDemoReadOnly);
}

export class DemoReadOnlyError extends Error {
  constructor() {
    super("This is a read-only demo — your changes weren't saved.");
    this.name = "DemoReadOnlyError";
  }
}

// Rejects mutating requests in demo mode, except export and the curator's session.
export function withDemoGuard(baseFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isDemoReadOnly() && MUTATING_METHODS.test(method) && !url.endsWith("/documents/export")) {
      return Promise.reject(new DemoReadOnlyError());
    }
    return baseFetch(input, init);
  };
}
