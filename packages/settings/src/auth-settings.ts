import { z } from "zod";
import { getSetting, setSetting } from "./settings";

// Self-service sign-up. Closed by default — an instance admin opens it from Settings. The very
// first account always bootstraps the instance admin regardless of this flag (enforced by the
// sign-up hook in apps/api/src/auth.ts).
export const registrationSettingsSchema = z.object({
  enabled: z.boolean(),
});

export type RegistrationSettings = z.infer<typeof registrationSettingsSchema>;

const KEYS = {
  enabled: "auth.registrationEnabled",
} as const;

export async function isRegistrationEnabled(): Promise<boolean> {
  return (await getSetting(KEYS.enabled)) === "true";
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  return { enabled: await isRegistrationEnabled() };
}

export async function setRegistrationSettings(values: RegistrationSettings): Promise<void> {
  await setSetting({ key: KEYS.enabled, value: values.enabled ? "true" : "false" });
}
