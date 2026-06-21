import { AI_PROVIDER_IDS, DEFAULT_AI_PROVIDER } from "@omnipaper/ai/registry";
import { isAiProvider } from "@omnipaper/ai/resolve";
import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

// Instance-wide AI classifier settings: which provider and (optional) model id drive the
// `ai.assignMetadata` action. Mirrors ocr-settings.ts — provider API keys live separately in
// provider-settings.ts. WHICH fields the AI fills and auto/suggest are per-org (the system
// workflow's definition), not here.
export const aiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string().optional(),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

const KEYS = {
  provider: "ai.provider",
  model: "ai.model",
} as const;

export async function getAiSettings(): Promise<AiSettings> {
  const stored = await getSetting(KEYS.provider);
  const provider = stored && isAiProvider(stored) ? stored : DEFAULT_AI_PROVIDER;
  const model = (await getSetting(KEYS.model)) ?? undefined;

  return { provider, model };
}

export async function setAiSettings(values: AiSettings): Promise<void> {
  await setSetting({ key: KEYS.provider, value: values.provider });

  if (values.model === undefined) {
    return;
  }

  // Blank model → fall back to the provider default; don't persist a stale/empty override.
  if (values.model.trim() === "") {
    await deleteSetting(KEYS.model);
    return;
  }

  await setSetting({ key: KEYS.model, value: values.model });
}
