export type Lane = "ocr" | "llm";

export type Provider = "mistral" | "google";

export type OcrDefinition = {
  id: string;
  /** Human label for the settings dropdown */
  label: string;
  lane: Lane;
  provider: Provider;
  /** Provider API model id — fixed value for the OCR lane, default for editable LLM lanes */
  defaultModel: string;
  /** Whether the admin may type a custom provider model id (LLM lanes that forward the string to the SDK) */
  modelEditable: boolean;
  mimeTypes: readonly string[];
};

const PDF = "application/pdf";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** PDF + common images — conservative defaults, extend after testing */
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
  "mistral-llm": {
    id: "mistral-llm",
    label: "Mistral (LLM)",
    lane: "llm",
    provider: "mistral",
    defaultModel: "mistral-small-latest",
    modelEditable: true,
    mimeTypes: DOCUMENT_MIMES,
  },
  "google-llm": {
    id: "google-llm",
    label: "Google Gemini (LLM)",
    lane: "llm",
    provider: "google",
    defaultModel: "gemini-2.5-flash",
    modelEditable: true,
    mimeTypes: DOCUMENT_MIMES,
  },
} as const satisfies Record<string, OcrDefinition>;

export type OcrDefinitionId = keyof typeof OCR_DEFINITIONS;

export const DEFAULT_OCR_DEFINITION_ID: OcrDefinitionId = "mistral-ocr";

export const OCR_DEFINITION_IDS = Object.keys(OCR_DEFINITIONS) as OcrDefinitionId[];
