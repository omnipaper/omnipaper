export const AI_MODEL_PROVIDERS = ["openai", "anthropic", "google", "mistral"] as const;

export type AiModelProvider = (typeof AI_MODEL_PROVIDERS)[number];

export const RECOMMENDED_MODEL = "recommended" as const;
