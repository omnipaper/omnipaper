import { AsyncLocalStorage } from "node:async_hooks";

type LogContext = Record<string, unknown>;

const storage = new AsyncLocalStorage<LogContext>();

// Merged rather than replaced: a nested scope must not drop the fields an outer one set.
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run({ ...storage.getStore(), ...context }, fn);
}

// Mutates the active store in place, so fields resolved mid-flight (a user id, an account id) also
// land on logs emitted earlier in the same scope by anything holding a reference to it.
export function addLogContext(context: LogContext): void {
  Object.assign(storage.getStore() ?? {}, context);
}

// Copied, not returned by reference: pino mutates whatever `mixin` hands it, which would leak every
// logged field into the store and contaminate the rest of the scope.
export function getLogContext(): LogContext {
  return { ...storage.getStore() };
}
