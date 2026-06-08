// Mirrors the server zod rule (apps/api/src/routes/storage-paths.ts): leading slash, segments of
// [A-Za-z0-9._-] separated by "/", no spaces, no trailing slash — e.g. "/Finance/2024/Invoices".
// Single source of truth on the client so the manager and the inline-create combobox can't drift.
export const STORAGE_PATH_PATTERN = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

export function isValidStoragePath(value: string): boolean {
  return STORAGE_PATH_PATTERN.test(value.trim());
}
