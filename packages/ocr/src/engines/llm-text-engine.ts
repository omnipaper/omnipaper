import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { LLM_TEXT_TIMEOUT_MS, MISTRAL_DOCUMENT_PAGE_LIMIT } from "../config/extraction";
import { TEXT_EXTRACTION_PROMPT } from "../prompts/text-extraction";
import type { OcrDefinition, Provider } from "../registry";
import type { DocumentInput } from "../types";

function documentContent({ documentUrl, mimeType }: DocumentInput) {
  if (mimeType.startsWith("image/")) {
    return { type: "image" as const, image: documentUrl };
  }

  return {
    type: "file" as const,
    data: documentUrl,
    mediaType: mimeType,
  };
}

function createLanguageModel(provider: Provider, model: string, apiKey: string) {
  if (provider === "mistral") {
    return createMistral({ apiKey })(model);
  }

  return createGoogleGenerativeAI({ apiKey })(model);
}

export async function extractWithLlm(
  definition: OcrDefinition,
  model: string,
  apiKey: string,
  input: DocumentInput,
): Promise<string> {
  const result = await generateText({
    model: createLanguageModel(definition.provider, model, apiKey),
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
  if (provider === "mistral") {
    const response = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Mistral connection failed (${response.status})`);
    }

    return;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    throw new Error(`Google connection failed (${response.status})`);
  }
}
