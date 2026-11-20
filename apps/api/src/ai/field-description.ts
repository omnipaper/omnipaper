import { resolveModel } from "@omnipaper/ai/model";
import { getAiRuntimeConfig } from "@omnipaper/settings/ai-settings";
import { generateText } from "ai";
import { z } from "zod";
import { errors } from "../errors";
import { buildFieldDescriptionPrompt } from "./field-description-prompt";

// Shared body of every `/describe` route. `id` is the row being edited, left out of the siblings.
export const describeFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
});

const TIMEOUT_MS = 30_000;

export async function writeFieldDescription(
  input: Parameters<typeof buildFieldDescriptionPrompt>[0],
): Promise<string> {
  const runtime = await getAiRuntimeConfig();
  if (!runtime.ok) {
    throw errors.conflict("ai_not_configured", runtime.detail);
  }

  const { config } = runtime;
  const { instructions, prompt } = buildFieldDescriptionPrompt(input);
  const result = await generateText({
    model: resolveModel(config.provider, config.model, config.apiKey),
    instructions,
    prompt,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    telemetry: { functionId: "field-description" },
  });

  return result.text.trim();
}
