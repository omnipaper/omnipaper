import type { ProviderKeys } from "@omnipaper/shared/provider";
import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

// API keys for every provider the instance can use: mistral/google power OCR, openai/anthropic (and
// mistral/google again) power the AI metadata classifier. One encrypted key per provider.
export const providerKeysSchema = z.object({
  mistral: z.string().optional(),
  google: z.string().optional(),
  openai: z.string().optional(),
  anthropic: z.string().optional(),
}) satisfies z.ZodType<ProviderKeys>;

export type { ProviderKeys };

export const providerTestSchema = z.object({
  provider: z.enum(["mistral", "google", "openai", "anthropic"]),
  apiKey: z.string(),
});

const KEYS = {
  mistral: "providers.mistral.apiKey",
  google: "providers.google.apiKey",
  openai: "providers.openai.apiKey",
  anthropic: "providers.anthropic.apiKey",
} as const;

export async function getProviderKeys(): Promise<ProviderKeys> {
  return {
    mistral: (await getSetting(KEYS.mistral)) ?? undefined,
    google: (await getSetting(KEYS.google)) ?? undefined,
    openai: (await getSetting(KEYS.openai)) ?? undefined,
    anthropic: (await getSetting(KEYS.anthropic)) ?? undefined,
  };
}

export async function setProviderKeys(values: ProviderKeys): Promise<void> {
  await persistKey(KEYS.mistral, values.mistral);
  await persistKey(KEYS.google, values.google);
  await persistKey(KEYS.openai, values.openai);
  await persistKey(KEYS.anthropic, values.anthropic);
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
