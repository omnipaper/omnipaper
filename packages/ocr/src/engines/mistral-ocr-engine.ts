import type { DocumentInput } from "../types";

export async function extractWithMistralOcr(
  input: DocumentInput & { apiKey: string; model: string },
): Promise<string> {
  const { apiKey, model, documentUrl, mimeType } = input;

  const document = mimeType.startsWith("image/")
    ? { type: "image_url", image_url: documentUrl }
    : { type: "document_url", document_url: documentUrl };

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, document }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mistral OCR failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { pages?: Array<{ markdown?: string }> };
  return (data.pages ?? []).map((page) => page.markdown ?? "").join("\n\n");
}

export async function testMistralConnection(apiKey: string): Promise<void> {
  const response = await fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Mistral connection failed (${response.status})`);
  }
}
