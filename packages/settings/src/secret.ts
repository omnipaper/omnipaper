// Sentinel returned to the client in place of a stored secret. When the client sends it back
// unchanged, the server keeps the existing secret instead of overwriting it (n8n-style pattern).
export const SECRET_MASK = "__omnipaper_secret_unchanged__";

export function unmaskSecret(incoming: string, stored: string | undefined): string {
  // The mask means "unchanged" → keep the stored value. If nothing is stored there is no value
  // to keep, so resolve to empty (callers treat blank as "clear/unset") instead of persisting
  // the sentinel string itself as a real secret.
  if (incoming === SECRET_MASK) {
    return stored ?? "";
  }

  return incoming;
}
