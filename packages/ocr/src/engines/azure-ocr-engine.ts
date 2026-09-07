import { OcrError } from "../resolve";
import type { DocumentInput } from "../types";

const API_VERSION = "2024-11-30";
const POLL_INTERVAL_MS = 2_000;
// Paid lane stays conservative: on timeout we fail terminally for a manual re-run instead of
// re-billing the whole analysis on an automatic retry.
const POLL_TIMEOUT_MS = 5 * 60_000;

type AzureOperation = {
  status: string;
  analyzeResult?: { content?: string };
  error?: { code?: string; message?: string };
};

function baseUrl(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function analyzeUrl(endpoint: string, model: string): string {
  const params = new URLSearchParams({ "api-version": API_VERSION });

  // Markdown output is a prebuilt-layout capability; other models reject the parameter.
  if (model === "prebuilt-layout") {
    params.set("outputContentFormat", "markdown");
  }

  return `${baseUrl(endpoint)}/documentintelligence/documentModels/${model}:analyze?${params}`;
}

async function azureFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    throw new OcrError(`Azure OCR request failed: ${message}`, { retryable: true });
  }
}

async function failWithResponse(response: Response): Promise<never> {
  const detail = await response.text();
  const retryable = response.status === 429 || response.status >= 500;
  throw new OcrError(`Azure OCR failed (${response.status}): ${detail}`, { retryable });
}

export async function extractWithAzureOcr(
  input: DocumentInput & { apiKey: string; model: string; endpoint: string },
): Promise<string> {
  const { data, apiKey, model, endpoint } = input;

  const submitted = await azureFetch(analyzeUrl(endpoint, model), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Source: Buffer.from(data).toString("base64") }),
  });

  if (submitted.status !== 202) {
    return failWithResponse(submitted);
  }

  const operationUrl = submitted.headers.get("operation-location");

  if (!operationUrl) {
    throw new OcrError("Azure OCR accepted the document but returned no operation location");
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (true) {
    const polled = await azureFetch(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
    });

    if (!polled.ok) {
      return failWithResponse(polled);
    }

    const operation = (await polled.json()) as AzureOperation;

    if (operation.status === "succeeded") {
      return operation.analyzeResult?.content ?? "";
    }

    if (operation.status === "failed") {
      throw new OcrError(
        `Azure OCR analysis failed: ${operation.error?.message ?? "unknown error"}`,
      );
    }

    if (Date.now() >= deadline) {
      throw new OcrError("Azure OCR timed out waiting for the analyze result");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function testAzureConnection(apiKey: string, endpoint: string): Promise<void> {
  const response = await fetch(
    `${baseUrl(endpoint)}/documentintelligence/documentModels?api-version=${API_VERSION}`,
    { headers: { "Ocp-Apim-Subscription-Key": apiKey } },
  );

  if (!response.ok) {
    throw new Error(`Azure connection failed (${response.status})`);
  }
}
