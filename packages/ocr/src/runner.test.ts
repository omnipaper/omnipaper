import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { extractText } from "./runner";

const fetchSpy = spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
});

afterAll(() => {
  fetchSpy.mockRestore();
});

const baseInput = {
  definitionId: "mistral-ocr",
  documentUrl: "https://files.test/invoice.pdf",
  mimeType: "application/pdf",
  keys: { mistral: "mistral-test-key" },
};

describe("extractText", () => {
  it("returns the extracted text from the selected OCR definition", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ pages: [{ markdown: "Invoice text" }] }), {
        status: 200,
      }),
    );

    const result = await extractText(baseInput);

    expect(result).toEqual({ text: "Invoice text" });
  });

  it("rejects when the selected provider has no API key", async () => {
    const promise = extractText({
      ...baseInput,
      keys: {},
    });

    await expect(promise).rejects.toThrow("Missing API key for provider: mistral");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects MIME types unsupported by the selected definition", async () => {
    const promise = extractText({
      ...baseInput,
      mimeType: "text/plain",
    });

    await expect(promise).rejects.toThrow("Mistral OCR does not support mime type: text/plain");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redacts provider secrets from errors", async () => {
    const apiKey = "mistral-secret-key";
    fetchSpy.mockResolvedValue(new Response(`provider received ${apiKey}`, { status: 400 }));

    const promise = extractText({
      ...baseInput,
      keys: { mistral: apiKey },
    });

    await expect(promise).rejects.toMatchObject({ retryable: false });
    await expect(promise).rejects.not.toThrow(apiKey);
  });

  it("preserves retryable provider errors", async () => {
    fetchSpy.mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));

    const promise = extractText(baseInput);

    await expect(promise).rejects.toMatchObject({ retryable: true });
  });
});
