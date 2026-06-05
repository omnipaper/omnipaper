// Sentinel returned to the client in place of a stored secret. When the client sends it back
// unchanged, the server keeps the existing secret instead of overwriting it (n8n-style pattern).
export const SECRET_MASK = "__omnipaper_secret_unchanged__";

export function unmaskSecret(incoming: string, stored: string | undefined): string {
  return incoming === SECRET_MASK ? (stored ?? incoming) : incoming;
}
