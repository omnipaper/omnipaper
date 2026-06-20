import {
  OCR_DEFINITIONS,
  type OcrDefinition,
  type OcrDefinitionId,
  type Provider,
} from "./registry";

export class OcrError extends Error {
  // Transient (429 rate limit, 5xx, network) → the OCR task rethrows so the queue retries with
  // backoff. Terminal (missing key, unsupported mime, 4xx) stays false → marked failed for re-run.
  readonly retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "OcrError";
    this.retryable = options?.retryable ?? false;
  }
}

export function getOcrDefinition(id: string): OcrDefinition {
  const definition = OCR_DEFINITIONS[id as OcrDefinitionId];

  if (!definition) {
    throw new OcrError(`Unknown OCR definition: ${id}`);
  }

  return definition;
}

export function isOcrDefinitionId(id: string): id is OcrDefinitionId {
  return id in OCR_DEFINITIONS;
}

function matchesMime(pattern: string, mimeType: string): boolean {
  if (pattern.endsWith("/*")) {
    return mimeType.startsWith(pattern.slice(0, -1));
  }

  return mimeType === pattern;
}

export function supportsMime(id: string, mimeType: string): boolean {
  const definition = getOcrDefinition(id);
  return definition.mimeTypes.some((pattern) => matchesMime(pattern, mimeType));
}

/** Fixed-model definitions ignore user input; editable lanes use it, falling back to the default. */
export function resolveModel(definition: OcrDefinition, userModel?: string): string {
  if (!definition.modelEditable) {
    return definition.defaultModel;
  }

  return userModel?.trim() || definition.defaultModel;
}

export function listOcrDefinitions(): OcrDefinition[] {
  return Object.values(OCR_DEFINITIONS);
}

export function definitionsForProvider(provider: Provider): OcrDefinition[] {
  return listOcrDefinitions().filter((definition) => definition.provider === provider);
}
