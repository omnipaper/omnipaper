import mammoth from "mammoth";

// The MIME set lives next to its extractor so ingestDocument() and the text-extract worker agree.

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TEXT_EXTRACT_MIMES: ReadonlySet<string> = new Set(["text/plain", DOCX_MIME]);

export function isTextExtractable(mimeType: string): boolean {
  return TEXT_EXTRACT_MIMES.has(mimeType);
}

// docx goes through mammoth (pure JS, same on bun and Node); the rest is decoded as UTF-8.
export async function extractDocumentText(mimeType: string, bytes: Uint8Array): Promise<string> {
  if (mimeType === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value.trim();
  }

  return new TextDecoder("utf-8").decode(bytes).trim();
}
