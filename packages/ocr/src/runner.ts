import { redactSecrets } from "@omnipaper/shared/redact";
import { extractWithAzureOcr, testAzureConnection } from "./engines/azure-ocr-engine";
import { extractWithLlm, testLlmProvider } from "./engines/llm-text-engine";
import { extractWithMistralOcr, testMistralConnection } from "./engines/mistral-ocr-engine";
import type { OcrDefinition, OcrDefinitionId, Provider } from "./registry";
import {
  getOcrDefinition,
  listOcrDefinitions,
  OcrError,
  resolveModel,
  supportsMime,
} from "./resolve";
import type { DocumentInput, ExtractTextResult, ProviderKeys } from "./types";

export type ExtractTextInput = DocumentInput & {
  definitionId: OcrDefinitionId | string;
  /** Custom provider model id; used only when the definition is modelEditable */
  model?: string;
  keys: ProviderKeys;
  /** Azure Document Intelligence resource endpoint; required by azure definitions */
  azureEndpoint?: string;
};

function requireProviderKey(provider: Provider, keys: ProviderKeys): string {
  const apiKey = keys[provider];

  if (!apiKey) {
    throw new OcrError(`Missing API key for provider: ${provider}`);
  }

  return apiKey;
}

function requireAzureEndpoint(endpoint: string | undefined): string {
  if (!endpoint) {
    throw new OcrError("Missing Azure endpoint");
  }

  return endpoint;
}

async function extractWithDefinition(
  definition: OcrDefinition,
  model: string,
  input: Omit<ExtractTextInput, "definitionId" | "model">,
): Promise<string> {
  const { keys, azureEndpoint, ...document } = input;
  const apiKey = requireProviderKey(definition.provider, keys);

  if (definition.lane === "ocr") {
    if (definition.provider === "azure") {
      return extractWithAzureOcr({
        ...document,
        apiKey,
        model,
        endpoint: requireAzureEndpoint(azureEndpoint),
      });
    }

    return extractWithMistralOcr({ ...document, apiKey, model });
  }

  return extractWithLlm(definition, model, apiKey, document);
}

export async function extractText(input: ExtractTextInput): Promise<ExtractTextResult> {
  const { definitionId, model, ...rest } = input;
  const definition = getOcrDefinition(definitionId);

  if (!supportsMime(definitionId, rest.mimeType)) {
    throw new OcrError(`${definition.label} does not support mime type: ${rest.mimeType}`);
  }

  const effectiveModel = resolveModel(definition, model);

  try {
    const text = await extractWithDefinition(definition, effectiveModel, rest);
    return { text };
  } catch (error) {
    const retryable = error instanceof OcrError && error.retryable;
    const message = error instanceof Error ? error.message : "OCR extraction failed";
    throw new OcrError(
      redactSecrets(message, rest.keys.mistral, rest.keys.google, rest.keys.azure),
      {
        retryable,
      },
    );
  }
}

export async function testDefinitionConnection(
  definitionId: OcrDefinitionId | string,
  keys: ProviderKeys,
  options?: { azureEndpoint?: string },
): Promise<void> {
  const definition = getOcrDefinition(definitionId);
  const apiKey = requireProviderKey(definition.provider, keys);

  if (definition.provider === "azure") {
    await testAzureConnection(apiKey, requireAzureEndpoint(options?.azureEndpoint));
    return;
  }

  if (definition.lane === "ocr") {
    await testMistralConnection(apiKey);
    return;
  }

  await testLlmProvider(definition.provider, apiKey);
}

export async function testProviderConnection(
  provider: Provider,
  keys: ProviderKeys,
  options?: { azureEndpoint?: string },
): Promise<void> {
  const definition = listOcrDefinitions().find((entry) => entry.provider === provider);

  if (!definition) {
    throw new OcrError(`No OCR definitions registered for provider: ${provider}`);
  }

  await testDefinitionConnection(definition.id, keys, options);
}
