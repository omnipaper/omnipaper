import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiModelProvider } from "@omnipaper/shared/ai-models";

export type AiProvider = AiModelProvider;

export function resolveModel(provider: AiProvider, model: string, apiKey: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "mistral":
      return createMistral({ apiKey })(model);
  }
}
