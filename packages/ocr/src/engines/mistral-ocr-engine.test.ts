import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { OcrError } from "../resolve";
import { extractWithMistralOcr } from "./mistral-ocr-engine";

const fetchSpy = spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
});

afterAll(() => {
  fetchSpy.mockRestore();
});

describe("extractWithMistralOcr", () => {
  it("sends PDF documents as document URLs and joins page text", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [{ markdown: "Page one" }, { markdown: "Page two" }],
        }),
        { status: 200 },
      ),
    );

    const text = await extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/invoice.pdf",
      mimeType: "application/pdf",
    });

    expect(text).toBe("Page one\n\nPage two");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://api.mistral.ai/v1/ocr");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer mistral-test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        document_url: "https://files.test/invoice.pdf",
      },
    });
  });

  it("sends image documents as image URLs", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ pages: [{ markdown: "Scanned text" }] }), {
        status: 200,
      }),
    );

    await extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/scan.png",
      mimeType: "image/png",
    });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "mistral-ocr-latest",
      document: {
        type: "image_url",
        image_url: "https://files.test/scan.png",
      },
    });
  });

  it("returns an empty string when the response has no pages", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const text = await extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/empty.pdf",
      mimeType: "application/pdf",
    });

    expect(text).toBe("");
  });

  it("marks network errors as retryable", async () => {
    fetchSpy.mockRejectedValue(new Error("connection reset"));

    const promise = extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/invoice.pdf",
      mimeType: "application/pdf",
    });

    await expect(promise).rejects.toThrow("connection reset");
    await expect(promise).rejects.toBeInstanceOf(OcrError);
  });

  it("marks rate limits and server errors as retryable", async () => {
    fetchSpy.mockResolvedValue(new Response("rate limited", { status: 429 }));

    const rateLimitError = extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/invoice.pdf",
      mimeType: "application/pdf",
    });

    await expect(rateLimitError).rejects.toMatchObject({ retryable: true });

    fetchSpy.mockResolvedValue(new Response("bad request", { status: 400 }));

    const badRequestError = extractWithMistralOcr({
      apiKey: "mistral-test-key",
      model: "mistral-ocr-latest",
      documentUrl: "https://files.test/invoice.pdf",
      mimeType: "application/pdf",
    });

    await expect(badRequestError).rejects.toMatchObject({ retryable: false });
  });
});
