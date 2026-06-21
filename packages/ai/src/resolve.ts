import { AI_PROVIDERS, type AiProvider, type AiProviderDefinition } from "./registry";

// Mirrors @omnipaper/ocr/resolve: a typed error carrying a retry hint, plus pure lookup helpers used
// by the settings layer and the workflow runner.

export class AiError extends Error {
  // Transient (429 rate limit, 5xx, network/timeout) → the workflow runner lets the queue retry with
  // backoff. Deterministic (bad model output, unknown provider, missing key) stays false: swallow and
  // log rather than churn through a paid retry that will fail identically.
  readonly retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "AiError";
    this.retryable = options?.retryable ?? false;
  }
}

export function getAiProvider(id: string): AiProviderDefinition {
  const provider = AI_PROVIDERS[id as AiProvider];

  if (!provider) {
    throw new AiError(`Unknown AI provider: ${id}`);
  }

  return provider;
}

export function isAiProvider(id: string): id is AiProvider {
  return id in AI_PROVIDERS;
}

// Model is always editable; fall back to the provider default when the user left it blank.
export function resolveModel(provider: AiProviderDefinition, userModel?: string): string {
  return userModel?.trim() || provider.defaultModel;
}

export function listAiProviders(): AiProviderDefinition[] {
  return Object.values(AI_PROVIDERS);
}
