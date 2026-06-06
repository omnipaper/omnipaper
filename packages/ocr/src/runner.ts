import { redactSecrets } from "@omnipaper/settings/secret";
import { extractWithLlm, testLlmProvider } from "./engines/llm-text-engine";
import { extractWithMistralOcr, testMistralConnection } from "./engines/mistral-ocr-engine";
import type { OcrDefinition, OcrDefinitionId, Provider } from "./registry";
import {
  OcrError,
  getOcrDefinition,
  listOcrDefinitions,
  resolveModel,
  supportsMime,
} from "./resolve";
import type { DocumentInput, ExtractTextResult, ProviderKeys } from "./types";

export type ExtractTextInput = DocumentInput & {
  definitionId: OcrDefinitionId | string;
  /** Custom provider model id; used only when the definition is modelEditable */
  model?: string;
  keys: ProviderKeys;
};

function requireProviderKey(provider: Provider, keys: ProviderKeys): string {
  const apiKey = keys[provider];

  if (!apiKey) {
    throw new OcrError(`Missing API key for provider: ${provider}`);
  }

  return apiKey;
}

async function extractWithDefinition(
  definition: OcrDefinition,
  model: string,
  keys: ProviderKeys,
  input: DocumentInput,
): Promise<string> {
  const apiKey = requireProviderKey(definition.provider, keys);

  if (definition.lane === "ocr") {
    return extractWithMistralOcr({ ...input, apiKey, model });
  }

  return extractWithLlm(definition, model, apiKey, input);
}

export async function extractText(input: ExtractTextInput): Promise<ExtractTextResult> {
  const { definitionId, model, keys, ...document } = input;
  const definition = getOcrDefinition(definitionId);

  if (!supportsMime(definitionId, document.mimeType)) {
    throw new OcrError(`${definition.label} does not support mime type: ${document.mimeType}`);
  }

  const effectiveModel = resolveModel(definition, model);

  try {
    const text = await extractWithDefinition(definition, effectiveModel, keys, document);
    return { text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR extraction failed";
    throw new OcrError(redactSecrets(message, keys.mistral, keys.google));
  }
}

export async function testDefinitionConnection(
  definitionId: OcrDefinitionId | string,
  keys: ProviderKeys,
): Promise<void> {
  const definition = getOcrDefinition(definitionId);
  const apiKey = requireProviderKey(definition.provider, keys);

  if (definition.lane === "ocr") {
    await testMistralConnection(apiKey);
    return;
  }

  await testLlmProvider(definition.provider, apiKey);
}

export async function testProviderConnection(
  provider: Provider,
  keys: ProviderKeys,
): Promise<void> {
  const definition = listOcrDefinitions().find((entry) => entry.provider === provider);

  if (!definition) {
    throw new OcrError(`No OCR definitions registered for provider: ${provider}`);
  }

  await testDefinitionConnection(definition.id, keys);
}
