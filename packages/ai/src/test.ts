import type { AiProvider } from "./registry";
import { getAiProvider } from "./resolve";

// Lightweight credential probe per provider: hit a cheap, side-effect-free endpoint (a models list)
// and surface a clear error if the key is rejected. Mirrors OCR's testLlmProvider. No model call, so
// it costs nothing and validates only the key.
export async function testAiConnection(provider: AiProvider, apiKey: string): Promise<void> {
  // Resolve to fail fast on an unknown provider id with a typed AiError.
  getAiProvider(provider);

  if (provider === "openai") {
    return probe("OpenAI", "https://api.openai.com/v1/models", {
      Authorization: `Bearer ${apiKey}`,
    });
  }

  if (provider === "anthropic") {
    return probe("Anthropic", "https://api.anthropic.com/v1/models", {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    });
  }

  if (provider === "mistral") {
    return probe("Mistral", "https://api.mistral.ai/v1/models", {
      Authorization: `Bearer ${apiKey}`,
    });
  }

  return probe(
    "Google",
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
}

async function probe(label: string, url: string, headers?: Record<string, string>): Promise<void> {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${label} connection failed (${response.status})`);
  }
}
