import type { AiAssignFields } from "@omnipaper/shared/workflows";
import { z } from "zod";
import type { AiCandidates } from "./candidates";

// The dynamic response schema: built from exactly the enabled fields and the org's candidate sets,
// so the LLM is constrained to real ids and the prompt/schema/token-cost track what's turned on.
// generateObject() enforces this best-effort per provider; apply.ts re-validates regardless.

// Sentinel the model returns when nothing fits — clearer than overloading null on enum fields.
export const NO_MATCH = "__none__";

// Field payloads the classifier returns. All optional: a given call only includes enabled fields.
export type AiClassifyResponse = {
  documentType?: { id: string; confidence: number };
  storagePath?: { id: string; confidence: number };
  tags?: { existingIds: string[]; newNames: string[]; confidence: number };
  documentDate?: { value: string | null; quote: string | null; confidence: number };
  customFields?: {
    definitionId: string;
    value: string | null;
    selectOptionId: string | null;
    confidence: number;
  }[];
};

const confidence = z.number().min(0).max(1);

// Constrain a single-choice id to the candidate set plus the sentinel. When there are no candidates
// the only legal answer is the sentinel (the model literally can't invent an id).
function choiceId(ids: string[]): z.ZodTypeAny {
  return ids.length > 0 ? z.enum([NO_MATCH, ...ids]) : z.literal(NO_MATCH);
}

export function buildResponseSchema(
  fields: AiAssignFields,
  candidates: AiCandidates,
): z.ZodType<AiClassifyResponse> {
  const shape: Record<string, z.ZodTypeAny> = {};

  if (fields.documentType) {
    shape.documentType = z.object({
      id: choiceId(candidates.documentTypes.map((t) => t.id)),
      confidence,
    });
  }

  if (fields.storagePath) {
    shape.storagePath = z.object({
      id: choiceId(candidates.storagePaths.map((p) => p.id)),
      confidence,
    });
  }

  if (fields.tags) {
    // Array members are plain strings (an empty array is the "none" case); membership is re-checked
    // against the candidate set in apply.ts, and newNames are gated there by allowNew.
    shape.tags = z.object({
      existingIds: z.array(z.string()).default([]),
      newNames: z.array(z.string()).default([]),
      confidence,
    });
  }

  if (fields.documentDate) {
    shape.documentDate = z.object({
      value: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      // The literal date string copied from the document — apply.ts rejects the value unless `quote`
      // really appears in the text, which kills hallucinated "today" dates.
      quote: z.string().nullable(),
      confidence,
    });
  }

  if (fields.customFields) {
    shape.customFields = z
      .array(
        z.object({
          definitionId: choiceId(candidates.customFields.map((f) => f.id)),
          value: z.string().nullable(),
          selectOptionId: z.string().nullable(),
          confidence,
        }),
      )
      .default([]);
  }

  return z.object(shape) as z.ZodType<AiClassifyResponse>;
}
