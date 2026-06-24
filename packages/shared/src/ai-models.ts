export type AiModelProvider = "openai" | "anthropic" | "google" | "mistral";

export type AiModel = { id: string; label: string };

// Stored model setting can be this sentinel (omnipaper-managed, auto-bumped across releases) or a
// concrete pinned id from the lists below. Curated short lists, not the full catalogs.
export const RECOMMENDED_MODEL = "recommended" as const;

export const AI_MODELS = {
  openai: {
    recommended: "gpt-5.4-mini",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5 (most capable)" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano (fastest)" },
    ],
  },
  anthropic: {
    recommended: "claude-haiku-4-5",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8 (most capable)" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest)" },
    ],
  },
  google: {
    recommended: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (most capable)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (newest)" },
    ],
  },
  mistral: {
    recommended: "mistral-small-latest",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large (most capable)" },
      { id: "mistral-medium-latest", label: "Mistral Medium" },
      { id: "mistral-small-latest", label: "Mistral Small" },
    ],
  },
} as const satisfies Record<AiModelProvider, { recommended: string; models: AiModel[] }>;

// "recommended" sentinel resolves to the provider's current recommended id; a concrete id passes
// through, falling back to recommended if it's no longer offered.
export function resolveAiModel(provider: AiModelProvider, model: string): string {
  const entry = AI_MODELS[provider];
  if (model === RECOMMENDED_MODEL) {
    return entry.recommended;
  }
  return entry.models.some((m) => m.id === model) ? model : entry.recommended;
}

export function isValidModelSetting(provider: AiModelProvider, model: string): boolean {
  return model === RECOMMENDED_MODEL || AI_MODELS[provider].models.some((m) => m.id === model);
}
