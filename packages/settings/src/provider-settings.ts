import type { ProviderKeys } from "@omnipaper/shared/provider";
import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

export const providerKeysSchema = z.object({
  mistral: z.string().optional(),
  google: z.string().optional(),
  openai: z.string().optional(),
  anthropic: z.string().optional(),
  azure: z.string().optional(),
}) satisfies z.ZodType<ProviderKeys>;

export type { ProviderKeys };

// The Azure resource endpoint travels with the keys but is plain config, not a secret.
export const providerSettingsUpdateSchema = providerKeysSchema.extend({
  azureEndpoint: z.string().optional(),
});

export type ProviderSettingsUpdate = z.infer<typeof providerSettingsUpdateSchema>;

// OCR provider connectivity test only supports the OCR providers; openai/anthropic keys are stored
// (providerKeysSchema) but have no test path yet. Azure additionally needs its resource endpoint.
export const providerTestSchema = z.object({
  provider: z.enum(["mistral", "google", "azure"]),
  apiKey: z.string(),
  endpoint: z.string().optional(),
});

const KEYS = {
  mistral: "providers.mistral.apiKey",
  google: "providers.google.apiKey",
  openai: "providers.openai.apiKey",
  anthropic: "providers.anthropic.apiKey",
  azure: "providers.azure.apiKey",
  azureEndpoint: "providers.azure.endpoint",
} as const;

export async function getProviderKeys(): Promise<ProviderKeys> {
  return {
    mistral: (await getSetting(KEYS.mistral)) ?? undefined,
    google: (await getSetting(KEYS.google)) ?? undefined,
    openai: (await getSetting(KEYS.openai)) ?? undefined,
    anthropic: (await getSetting(KEYS.anthropic)) ?? undefined,
    azure: (await getSetting(KEYS.azure)) ?? undefined,
  };
}

export async function getAzureEndpoint(): Promise<string | undefined> {
  return (await getSetting(KEYS.azureEndpoint)) ?? undefined;
}

export async function setProviderSettings(values: ProviderSettingsUpdate): Promise<void> {
  await persistValue(KEYS.mistral, values.mistral, { secret: true });
  await persistValue(KEYS.google, values.google, { secret: true });
  await persistValue(KEYS.openai, values.openai, { secret: true });
  await persistValue(KEYS.anthropic, values.anthropic, { secret: true });
  await persistValue(KEYS.azure, values.azure, { secret: true });
  await persistValue(KEYS.azureEndpoint, values.azureEndpoint, { secret: false });
}

// undefined → field not submitted, leave the stored value untouched.
// Blank → admin cleared the field, delete the row (storing "" would be a non-functional value).
// Otherwise persist (encrypted when secret).
async function persistValue(
  key: string,
  value: string | undefined,
  options: { secret: boolean },
): Promise<void> {
  if (value === undefined) {
    return;
  }

  if (value.trim() === "") {
    await deleteSetting(key);
    return;
  }

  await setSetting({ key, value, secret: options.secret });
}
