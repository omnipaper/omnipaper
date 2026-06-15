import mammoth from "mammoth";

// Native text extraction for types we can read without an external OCR provider. This is the
// "extract" lane — distinct from the OCR lane (@omnipaper/ocr) and from the upload allow-list
// (@omnipaper/shared/formats). The MIME set lives here, next to the extractor that implements it,
// so the triage in ingestDocument() and the text-extract worker share one source of truth.

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEXT_EXTRACT_MIMES: ReadonlySet<string> = new Set(["text/plain", DOCX_MIME]);

export function isTextExtractable(mimeType: string): boolean {
  return TEXT_EXTRACT_MIMES.has(mimeType);
}

// Pull plain text out of the document bytes. docx is unzipped + parsed by mammoth (pure JS, runs the
// same on bun and Node); everything else routed here is decoded as UTF-8 text. The result feeds the
// same full-text index as OCR output.
export async function extractDocumentText(mimeType: string, bytes: Uint8Array): Promise<string> {
  if (mimeType === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value.trim();
  }

  return new TextDecoder("utf-8").decode(bytes).trim();
}
