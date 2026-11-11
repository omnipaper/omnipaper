import { z } from "zod";
import { OcrError } from "../resolve";
import type { DocumentInput } from "../types";

const mistralResponseSchema = z.object({
  pages: z.array(z.object({ markdown: z.string() })),
});

export async function extractWithMistralOcr(
  input: DocumentInput & { apiKey: string; model: string },
): Promise<string> {
  const { apiKey, model, data, mimeType } = input;

  // Bytes go inline as a data URL so the bucket never has to be reachable from Mistral's side.
  const dataUrl = `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;

  const document = mimeType.startsWith("image/")
    ? { type: "image_url", image_url: dataUrl }
    : { type: "document_url", document_url: dataUrl };

  let response: Response;
  try {
    response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, document }),
    });
  } catch (error) {
    // Network/timeout — transient, worth retrying.
    const message = error instanceof Error ? error.message : "network error";
    throw new OcrError(`Mistral OCR request failed: ${message}`, { retryable: true });
  }

  if (!response.ok) {
    const detail = await response.text();
    // 429 (rate limit) and 5xx are transient → retryable; other 4xx are terminal config/input errors.
    const retryable = response.status === 429 || response.status >= 500;
    throw new OcrError(`Mistral OCR failed (${response.status}): ${detail}`, { retryable });
  }

  const parsed = mistralResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new OcrError(`Mistral OCR returned an unexpected response: ${parsed.error.message}`, {
      retryable: false,
    });
  }
  return parsed.data.pages.map((page) => page.markdown).join("\n\n");
}

export async function testMistralConnection(apiKey: string): Promise<void> {
  const response = await fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Mistral connection failed (${response.status})`);
  }
}
