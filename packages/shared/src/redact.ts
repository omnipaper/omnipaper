export function redactSecrets(message: string, ...secrets: (string | null | undefined)[]): string {
  let redacted = message;

  for (const secret of secrets) {
    if (!secret) continue;
    redacted = redacted.split(secret).join("****").split(encodeURIComponent(secret)).join("****");
  }

  return redacted;
}
