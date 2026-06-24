import type { AiProvider } from "./model";

// Lightweight auth check: hit each provider's models endpoint. Spends no tokens (unlike a generate
// call) and throws on a non-2xx so the caller can surface the error.
export async function testAiProvider(provider: AiProvider, apiKey: string): Promise<void> {
  const { url, headers } = endpoint(provider, apiKey);
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`${provider} connection failed (${res.status})`);
  }
}

function endpoint(
  provider: AiProvider,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/models",
        headers: { Authorization: `Bearer ${apiKey}` },
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      };
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        headers: {},
      };
    case "mistral":
      return {
        url: "https://api.mistral.ai/v1/models",
        headers: { Authorization: `Bearer ${apiKey}` },
      };
  }
}
