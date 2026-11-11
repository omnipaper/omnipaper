export type Lane = "ocr" | "llm";

export type Provider = "mistral" | "google" | "azure";

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

// Azure Document Intelligence does not accept webp/gif (unlike Mistral).
const AZURE_DOCUMENT_MIMES = [
  PDF,
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/heif",
] as const;

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
  "azure-document-intelligence": {
    id: "azure-document-intelligence",
    label: "Azure Document Intelligence",
    lane: "ocr",
    provider: "azure",
    defaultModel: "prebuilt-layout",
    modelEditable: true,
    mimeTypes: AZURE_DOCUMENT_MIMES,
  },
  // LLM lanes are hidden for now. The runner's "llm" lane and the Google provider are still wired,
  // so re-adding a `lane: "llm"` entry here is enough to bring one back.
} as const satisfies Record<string, OcrDefinition>;

export type OcrDefinitionId = keyof typeof OCR_DEFINITIONS;

export const DEFAULT_OCR_DEFINITION_ID: OcrDefinitionId = "mistral-ocr";

export const OCR_DEFINITION_IDS = Object.keys(OCR_DEFINITIONS) as OcrDefinitionId[];
