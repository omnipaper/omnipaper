import {
  AI_MODEL_PROVIDERS,
  type AiModelProvider,
  isValidModelSetting,
  RECOMMENDED_MODEL,
  resolveAiModel,
} from "@omnipaper/shared/ai-models";
import { z } from "zod";
import { getProviderKeys } from "./provider-settings";
import { getSetting, setSetting } from "./settings";

// Provider + model for AI metadata assignment. Mirrors ocr-settings; keys live in provider-settings.
// `model` is either the "recommended" sentinel (we bump it across releases) or a concrete pinned id.
export type AiProvider = AiModelProvider;

export const aiSettingsSchema = z
  .object({
    provider: z.enum(AI_MODEL_PROVIDERS),
    model: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!isValidModelSetting(value.provider, value.model)) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Unknown model for this provider" });
    }
  });

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const aiProviderTestSchema = z.object({
  provider: z.enum(AI_MODEL_PROVIDERS),
  apiKey: z.string(),
});

const DEFAULT_PROVIDER: AiProvider = "openai";

const KEYS = {
  provider: "ai.provider",
  model: "ai.model",
} as const;

function isAiProvider(value: string | null): value is AiProvider {
  return value !== null && (AI_MODEL_PROVIDERS as readonly string[]).includes(value);
}

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await getSetting(KEYS.provider);
  const provider = isAiProvider(stored) ? stored : DEFAULT_PROVIDER;
  const model = (await getSetting(KEYS.model)) ?? RECOMMENDED_MODEL;

  return { provider, model };
}

export async function setAiSettings(values: AiSettings): Promise<void> {
  await setSetting({ key: KEYS.provider, value: values.provider });
  await setSetting({ key: KEYS.model, value: values.model });
}

export type AiRuntimeConfig = { provider: AiProvider; model: string; apiKey: string };

export async function getAiRuntimeConfig(): Promise<
  { ok: true; config: AiRuntimeConfig } | { ok: false; detail: string }
> {
  const { provider, model } = await getAiSettings();
  const apiKey = (await getProviderKeys())[provider];
  if (!apiKey) {
    return { ok: false, detail: `missing ${provider} API key` };
  }

  return { ok: true, config: { provider, model: resolveAiModel(provider, model), apiKey } };
}
