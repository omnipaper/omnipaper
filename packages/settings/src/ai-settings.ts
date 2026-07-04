import { isValidModelSetting, RECOMMENDED_MODEL } from "@omnipaper/shared/ai-models";
import { z } from "zod";
import { getSetting, setSetting } from "./settings";

// Provider + model for AI metadata assignment. Mirrors ocr-settings; keys live in provider-settings.
// `model` is either the "recommended" sentinel (we bump it across releases) or a concrete pinned id.
const AI_PROVIDERS = ["openai", "anthropic", "google", "mistral"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const aiSettingsSchema = z
  .object({
    provider: z.enum(AI_PROVIDERS),
    model: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!isValidModelSetting(value.provider, value.model)) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Unknown model for this provider" });
    }
  });

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const aiProviderTestSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string(),
});

const DEFAULT_PROVIDER: AiProvider = "openai";

const KEYS = {
  provider: "ai.provider",
  model: "ai.model",
} as const;

function isAiProvider(value: string | null): value is AiProvider {
  return value !== null && (AI_PROVIDERS as readonly string[]).includes(value);
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
