import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// Registry of chat-LLM providers for structured metadata classification — the AI counterpart of the
// OCR registry (packages/ocr/src/registry.ts). The Vercel AI SDK's generateObject() abstracts each
// provider's native structured-output mechanism (OpenAI json_schema, Anthropic tool-use, Gemini
// responseSchema, Mistral json_schema), so one code path drives all four. Adherence still isn't
// trusted: classify.ts re-validates every response with Zod, and the call site re-checks ids against
// the org's data (see workflow-run). The provider/model/key are instance-wide settings.

export const AI_PROVIDER_IDS = ["openai", "anthropic", "google", "mistral"] as const;

export type AiProvider = (typeof AI_PROVIDER_IDS)[number];

export type AiProviderDefinition = {
  id: AiProvider;
  label: string;
  // Suggested model id; the model is always free-text editable (like the OCR LLM lanes).
  defaultModel: string;
  // Build a LanguageModel for generateObject(). Keys are passed per-call, never read from env, so
  // the same process can serve different orgs/keys without a provider singleton.
  createModel: (model: string, apiKey: string) => LanguageModel;
};

export const AI_PROVIDERS = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    createModel: (model, apiKey) => createOpenAI({ apiKey })(model),
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    createModel: (model, apiKey) => createAnthropic({ apiKey })(model),
  },
  google: {
    id: "google",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    createModel: (model, apiKey) => createGoogleGenerativeAI({ apiKey })(model),
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    defaultModel: "mistral-small-latest",
    createModel: (model, apiKey) => createMistral({ apiKey })(model),
  },
} as const satisfies Record<AiProvider, AiProviderDefinition>;

export const DEFAULT_AI_PROVIDER: AiProvider = "openai";
