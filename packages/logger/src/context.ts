import { AsyncLocalStorage } from "node:async_hooks";

type LogContext = Record<string, unknown>;

const storage = new AsyncLocalStorage<LogContext>();

// Merged, so a nested scope keeps the fields an outer one set.
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run({ ...storage.getStore(), ...context }, fn);
}

// Mutated in place, so fields resolved mid-flight also reach anything already holding the store.
export function addLogContext(context: LogContext): void {
  Object.assign(storage.getStore() ?? {}, context);
}

// Copied: pino mutates what `mixin` returns, which would leak logged fields into the store.
export function getLogContext(): LogContext {
  return { ...storage.getStore() };
}
