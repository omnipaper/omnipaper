import type { OcrAdapter } from "../adapter";

export type MistralOcrConfig = {
  apiKey: string;
};

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";

export const createMistralOcr = (config: MistralOcrConfig): OcrAdapter => {
  return {
    name: "mistral",
    extract: async ({ documentUrl, mimeType }) => {
      const document = mimeType.startsWith("image/")
        ? { type: "image_url", image_url: documentUrl }
        : { type: "document_url", document_url: documentUrl };

      const response = await fetch(MISTRAL_OCR_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "mistral-ocr-latest", document }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mistral OCR failed (${response.status}): ${detail}`);
      }

      const data = (await response.json()) as { pages?: Array<{ markdown?: string }> };
      const text = (data.pages ?? []).map((page) => page.markdown ?? "").join("\n\n");

      return { text };
    },

    testConnection: async () => {
      const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });

      if (!response.ok) {
        throw new Error(`Mistral connection failed (${response.status})`);
      }
    },
  };
};
