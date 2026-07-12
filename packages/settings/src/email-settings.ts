import { getSetting, setSetting } from "./settings";

// SSRF opt-out: hosted stays locked down (user-supplied IMAP hosts must resolve to public IPs);
// self-hosters flip this to reach a mail server on their own LAN. Admin-gated settings route.
const ALLOW_INTERNAL_HOSTS_KEY = "email.allowInternalHosts";

export async function getEmailIngestAllowInternalHosts(): Promise<boolean> {
  return (await getSetting(ALLOW_INTERNAL_HOSTS_KEY)) === "true";
}

export async function setEmailIngestAllowInternalHosts(value: boolean): Promise<void> {
  await setSetting({ key: ALLOW_INTERNAL_HOSTS_KEY, value: value ? "true" : "false" });
}
