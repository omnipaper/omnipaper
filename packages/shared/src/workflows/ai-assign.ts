import { z } from "zod";

// Config for the `ai.assignMetadata` action: which metadata fields the single LLM call should fill,
// and per field whether to write it straight onto the document (`auto`) or stage a suggestion the
// user confirms (`suggest`). A field absent from `fields` is NOT enabled and never enters the
// prompt — that keeps the request (and the token bill) scoped to exactly what the user turned on.

export const AI_FIELD_MODES = ["auto", "suggest"] as const;
export const aiFieldModeSchema = z.enum(AI_FIELD_MODES);
export type AiFieldMode = (typeof AI_FIELD_MODES)[number];

// The metadata fields the AI action can fill. `customFields` fans out to one suggestion per
// definition id at runtime; the others are single-valued. Tags are the only multi-value target.
export const AI_FIELD_IDS = [
  "documentType",
  "storagePath",
  "tags",
  "documentDate",
  "customFields",
] as const;
export type AiFieldId = (typeof AI_FIELD_IDS)[number];

export const TAGS_MAX_DEFAULT = 6;
export const TAGS_MAX_LIMIT = 20;

const fieldModeConfig = z.object({ mode: aiFieldModeSchema });

export const aiAssignFieldsSchema = z
  .object({
    documentType: fieldModeConfig.optional(),
    storagePath: fieldModeConfig.optional(),
    tags: z
      .object({
        mode: aiFieldModeSchema,
        // Let the model propose brand-new tag names. Gated to `suggest` mode at the call site so a
        // human always approves new vocabulary before it enters the org's tag set.
        allowNew: z.boolean().default(false),
        max: z.number().int().min(1).max(TAGS_MAX_LIMIT).default(TAGS_MAX_DEFAULT),
      })
      .optional(),
    documentDate: fieldModeConfig.optional(),
    customFields: z
      .object({ mode: aiFieldModeSchema, definitionIds: z.array(z.string().min(1)).min(1) })
      .optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, {
    message: "Enable at least one field for the AI action",
  });

export type AiAssignFields = z.infer<typeof aiAssignFieldsSchema>;

export const aiAssignParamsSchema = z.object({
  // Optional model override; falls back to the instance-wide ai.model setting.
  model: z.string().optional(),
  fields: aiAssignFieldsSchema,
});

export type AiAssignParams = z.infer<typeof aiAssignParamsSchema>;
