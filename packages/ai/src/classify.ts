import { redactSecrets } from "@omnipaper/shared/redact";
import { APICallError, generateObject } from "ai";
import type { z } from "zod";
import type { AiProvider } from "./registry";
import { AiError, getAiProvider } from "./resolve";

// Time budget for one classification call. Generous (documents can be long), but bounded so a stuck
// provider connection surfaces as a retryable timeout instead of hanging the worker. Mirrors the OCR
// LLM timeout posture.
const CLASSIFY_TIMEOUT_MS = 60_000;

export type ClassifyInput<T> = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  // System prompt: the task framing + the candidate lists (ids → labels → descriptions).
  system: string;
  // User prompt: the document's extracted text.
  prompt: string;
  // Dynamic schema built from exactly the enabled fields (workflow-run/ai/schema.ts). generateObject
  // constrains the provider to it AND validates the response; the call site re-checks ids against the
  // org's data regardless, since provider adherence varies.
  schema: z.ZodType<T>;
};

// One structured LLM call covering all enabled fields. Returns the schema-validated object; throws
// AiError (retryable flag set) so the runner can apply the same lane-aware retry posture as OCR.
export async function classifyDocument<T>(input: ClassifyInput<T>): Promise<T> {
  const provider = getAiProvider(input.provider);

  try {
    const { object } = await generateObject({
      model: provider.createModel(input.model, input.apiKey),
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
    });

    return object;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI classification failed";
    throw new AiError(redactSecrets(message, input.apiKey), { retryable: isRetryable(error) });
  }
}

// Transient provider failures are worth retrying; a malformed/unschema'd object is deterministic and
// would just re-bill on retry.
function isRetryable(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    if (typeof error.isRetryable === "boolean") {
      return error.isRetryable;
    }
    const status = error.statusCode;
    return status === 429 || (status !== undefined && status >= 500);
  }

  // AbortSignal.timeout rejects with a TimeoutError — treat as transient.
  return error instanceof Error && error.name === "TimeoutError";
}
