export type Lane = "ocr" | "llm";

export type Provider = "mistral" | "google";

export type OcrDefinition = {
  id: string;
  label: string;
  lane: Lane;
  provider: Provider;
  defaultModel: string;
  modelEditable: boolean;
  mimeTypes: readonly string[];
};

const PDF = "application/pdf";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const DOCUMENT_MIMES = [PDF, ...IMAGE_MIMES] as const;

export const OCR_DEFINITIONS = {
  "mistral-ocr": {
    id: "mistral-ocr",
    label: "Mistral OCR",
    lane: "ocr",
    provider: "mistral",
    defaultModel: "mistral-ocr-latest",
    modelEditable: false,
    mimeTypes: DOCUMENT_MIMES,
  },
  // v0.0.1 ships Mistral OCR ONLY. The LLM lanes below stay here, commented, to re-enable in 0.2.0 —
  // uncomment to restore them in the engine dropdown. Everything they need is still in place and
  // dormant: the runner's "llm" lane (runner.ts / llm-text-engine.ts), the Google provider, and the
  // Google API-key plumbing in provider-settings. No other code change is required to bring them back.
  // "mistral-llm": {
  //   id: "mistral-llm",
  //   label: "Mistral (LLM)",
  //   lane: "llm",
  //   provider: "mistral",
  //   defaultModel: "mistral-small-latest",
  //   modelEditable: true,
  //   mimeTypes: DOCUMENT_MIMES,
  // },
  // "google-llm": {
  //   id: "google-llm",
  //   label: "Google Gemini (LLM)",
  //   lane: "llm",
  //   provider: "google",
  //   defaultModel: "gemini-2.5-flash",
  //   modelEditable: true,
  //   mimeTypes: DOCUMENT_MIMES,
  // },
} as const satisfies Record<string, OcrDefinition>;

export type OcrDefinitionId = keyof typeof OCR_DEFINITIONS;

export const DEFAULT_OCR_DEFINITION_ID: OcrDefinitionId = "mistral-ocr";

export const OCR_DEFINITION_IDS = Object.keys(OCR_DEFINITIONS) as OcrDefinitionId[];
