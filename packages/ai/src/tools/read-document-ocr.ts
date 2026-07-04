import { tool } from "ai";
import { z } from "zod";

export function readDocumentOcrTool(ocrText: string) {
  return tool({
    description:
      "Read a slice of the document's full OCR text when the provided text is truncated.",
    inputSchema: z.object({
      offset: z.number().int().min(0),
      length: z.number().int().min(1).max(20000),
    }),
    execute: async ({ offset, length }) => ({
      text: ocrText.slice(offset, offset + length),
      totalLength: ocrText.length,
    }),
  });
}
