import { type AiProvider, resolveModel } from "@omnipaper/ai/model";
import { testAiProvider } from "@omnipaper/ai/test";
import { generateText } from "ai";
import { LLM_TEXT_TIMEOUT_MS, MISTRAL_DOCUMENT_PAGE_LIMIT } from "../config/extraction";
import { TEXT_EXTRACTION_PROMPT } from "../prompts/text-extraction";
import type { OcrDefinition, Provider } from "../registry";
import type { DocumentInput } from "../types";

function documentContent({ data, mimeType }: DocumentInput) {
  return {
    type: "file" as const,
    data,
    mediaType: mimeType,
  };
}

// The llm lane only registers mistral/google definitions; azure exists solely on the ocr lane.
function llmProvider(provider: Provider): AiProvider {
  return provider === "mistral" ? "mistral" : "google";
}

export async function extractWithLlm(
  definition: OcrDefinition,
  model: string,
  apiKey: string,
  input: DocumentInput,
): Promise<string> {
  const result = await generateText({
    model: resolveModel(llmProvider(definition.provider), model, apiKey),
    temperature: 0.1,
    abortSignal: AbortSignal.timeout(LLM_TEXT_TIMEOUT_MS),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: TEXT_EXTRACTION_PROMPT }, documentContent(input)],
      },
    ],
    ...(definition.provider === "mistral"
      ? {
          providerOptions: {
            mistral: { documentPageLimit: MISTRAL_DOCUMENT_PAGE_LIMIT },
          },
        }
      : {}),
  });

  return result.text.trim();
}

export async function testLlmProvider(provider: Provider, apiKey: string): Promise<void> {
  await testAiProvider(llmProvider(provider), apiKey);
}
