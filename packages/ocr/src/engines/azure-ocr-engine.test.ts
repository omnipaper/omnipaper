import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { OcrError } from "../resolve";
import { extractWithAzureOcr, testAzureConnection } from "./azure-ocr-engine";

const fetchSpy = spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
});

afterAll(() => {
  fetchSpy.mockRestore();
});

const pdfBytes = new TextEncoder().encode("%PDF-1.4 test");

const baseInput = {
  apiKey: "azure-test-key",
  model: "prebuilt-layout",
  endpoint: "https://myres.cognitiveservices.azure.com",
  data: pdfBytes,
  mimeType: "application/pdf",
};

const operationUrl =
  "https://myres.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/op-1?api-version=2024-11-30";

function accepted(): Response {
  return new Response(null, {
    status: 202,
    headers: { "operation-location": operationUrl },
  });
}

function operation(status: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ status, ...extra }), { status: 200 });
}

describe("extractWithAzureOcr", () => {
  it("submits the document as base64 and returns the analyzed content", async () => {
    fetchSpy
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(
        operation("succeeded", { analyzeResult: { content: "# Invoice\n\nTotal: 42" } }),
      );

    const text = await extractWithAzureOcr(baseInput);

    expect(text).toBe("# Invoice\n\nTotal: 42");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [submitUrl, submitInit] = fetchSpy.mock.calls[0] ?? [];
    expect(String(submitUrl)).toBe(
      "https://myres.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30&outputContentFormat=markdown",
    );
    expect(submitInit?.method).toBe("POST");
    expect(submitInit?.headers).toEqual({
      "Ocp-Apim-Subscription-Key": "azure-test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(submitInit?.body))).toEqual({
      base64Source: Buffer.from(pdfBytes).toString("base64"),
    });

    const [pollUrl, pollInit] = fetchSpy.mock.calls[1] ?? [];
    expect(String(pollUrl)).toBe(operationUrl);
    expect(pollInit?.headers).toEqual({ "Ocp-Apim-Subscription-Key": "azure-test-key" });
  });

  it("requests plain text output for models other than prebuilt-layout", async () => {
    fetchSpy
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(operation("succeeded", { analyzeResult: { content: "plain" } }));

    await extractWithAzureOcr({ ...baseInput, model: "prebuilt-read" });

    const [submitUrl] = fetchSpy.mock.calls[0] ?? [];
    expect(String(submitUrl)).toBe(
      "https://myres.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30",
    );
  });

  it("strips trailing slashes from the endpoint", async () => {
    fetchSpy
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(operation("succeeded", { analyzeResult: { content: "ok" } }));

    await extractWithAzureOcr({
      ...baseInput,
      endpoint: "https://myres.cognitiveservices.azure.com/",
    });

    const [submitUrl] = fetchSpy.mock.calls[0] ?? [];
    expect(String(submitUrl)).toStartWith(
      "https://myres.cognitiveservices.azure.com/documentintelligence/",
    );
  });

  it("keeps polling while the operation is running", async () => {
    fetchSpy
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(operation("running"))
      .mockResolvedValueOnce(operation("succeeded", { analyzeResult: { content: "late" } }));

    const text = await extractWithAzureOcr(baseInput);

    expect(text).toBe("late");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("marks rate limits and server errors on submit as retryable", async () => {
    fetchSpy.mockResolvedValue(new Response("throttled", { status: 429 }));

    await expect(extractWithAzureOcr(baseInput)).rejects.toMatchObject({ retryable: true });

    fetchSpy.mockResolvedValue(new Response("bad request", { status: 400 }));

    await expect(extractWithAzureOcr(baseInput)).rejects.toMatchObject({ retryable: false });
  });

  it("marks network errors as retryable", async () => {
    fetchSpy.mockRejectedValue(new Error("connection reset"));

    const promise = extractWithAzureOcr(baseInput);

    await expect(promise).rejects.toThrow("connection reset");
    await expect(promise).rejects.toMatchObject({ retryable: true });
  });

  it("fails terminally when the accepted response has no operation location", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 202 }));

    const promise = extractWithAzureOcr(baseInput);

    await expect(promise).rejects.toBeInstanceOf(OcrError);
    await expect(promise).rejects.toMatchObject({ retryable: false });
  });

  it("fails terminally when the analysis itself fails", async () => {
    fetchSpy
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(
        operation("failed", { error: { code: "InvalidRequest", message: "corrupt document" } }),
      );

    const promise = extractWithAzureOcr(baseInput);

    await expect(promise).rejects.toThrow("corrupt document");
    await expect(promise).rejects.toMatchObject({ retryable: false });
  });
});

describe("testAzureConnection", () => {
  it("lists the resource's models with the given key", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ value: [] }), { status: 200 }));

    await testAzureConnection("azure-test-key", "https://myres.cognitiveservices.azure.com/");

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://myres.cognitiveservices.azure.com/documentintelligence/documentModels?api-version=2024-11-30",
    );
    expect(init?.headers).toEqual({ "Ocp-Apim-Subscription-Key": "azure-test-key" });
  });

  it("throws on a rejected key", async () => {
    fetchSpy.mockResolvedValue(new Response("denied", { status: 401 }));

    await expect(
      testAzureConnection("azure-test-key", "https://myres.cognitiveservices.azure.com"),
    ).rejects.toThrow("Azure connection failed (401)");
  });
});
