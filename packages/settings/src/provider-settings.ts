import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

// Provider API keys are shared per-provider (used by OCR now, and a future AI section later),
// so they live under their own `providers.*` namespace rather than under any one feature.
export const providerKeysSchema = z.object({
  mistral: z.string().optional(),
  google: z.string().optional(),
});

export type ProviderKeys = z.infer<typeof providerKeysSchema>;

export const providerTestSchema = z.object({
  provider: z.enum(["mistral", "google"]),
  apiKey: z.string(),
});

const KEYS = {
  mistral: "providers.mistral.apiKey",
  google: "providers.google.apiKey",
} as const;

export async function getProviderKeys(): Promise<ProviderKeys> {
  return {
    mistral: (await getSetting(KEYS.mistral)) ?? undefined,
    google: (await getSetting(KEYS.google)) ?? undefined,
  };
}

export async function setProviderKeys(values: ProviderKeys): Promise<void> {
  await persistKey(KEYS.mistral, values.mistral);
  await persistKey(KEYS.google, values.google);
}

// undefined → field not submitted, leave the stored key untouched.
// Blank → admin cleared the field, delete the row (storing "" would be a non-functional key).
// Otherwise persist the key encrypted.
async function persistKey(key: string, value: string | undefined): Promise<void> {
  if (value === undefined) {
    return;
  }

  if (value.trim() === "") {
    await deleteSetting(key);
    return;
  }

  await setSetting({ key, value, secret: true });
}
