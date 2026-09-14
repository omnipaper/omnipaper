import { resolveModel } from "@omnipaper/ai/model";
import type { AiRuntimeConfig } from "@omnipaper/settings/ai-settings";
import { generateText } from "ai";

// The three metadata fields whose descriptions guide the classifier. The label is what the prompt
// calls the field so the rewrite stays in the right register.
const KIND_LABELS = {
  tag: "tag",
  documentType: "document type",
  storagePath: "storage path",
} as const;

export type FieldKind = keyof typeof KIND_LABELS;

const TIMEOUT_MS = 30_000;

export async function improveFieldDescription(input: {
  kind: FieldKind;
  name: string;
  description: string;
  config: AiRuntimeConfig;
}): Promise<string> {
  const label = KIND_LABELS[input.kind];
  const instructions = [
    `You improve ${label} descriptions used by an AI that auto-classifies documents.`,
    `A ${label} description tells the classifier when "${input.name}" applies to a document.`,
    "Rewrite the user's draft so it is clear and specific about when this applies and how it",
    "differs from similar ones. Keep it to one or two sentences, in the same language as the draft.",
    "Return only the improved description: no quotes, no preamble, no trailing notes.",
  ].join(" ");

  const result = await generateText({
    model: resolveModel(input.config.provider, input.config.model, input.config.apiKey),
    instructions,
    prompt: `Name: ${input.name}\nDraft description: ${input.description}`,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    telemetry: { functionId: "improve-field-description" },
  });

  return result.text.trim();
}
