// Sent to the client instead of a stored secret; sent back unchanged, it keeps the stored one.
export const SECRET_MASK = "__omnipaper_secret_unchanged__";

export function unmaskSecret(incoming: string, stored: string | undefined): string {
  // Nothing stored means nothing to keep: resolve to empty rather than persist the sentinel.
  if (incoming === SECRET_MASK) {
    return stored ?? "";
  }

  return incoming;
}
