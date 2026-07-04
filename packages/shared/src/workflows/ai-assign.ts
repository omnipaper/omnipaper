import { z } from "zod";

const fieldMode = z.enum(["apply", "suggest"]);
const field = z.object({ mode: fieldMode });

export const aiAssignParamsSchema = z
  .object({
    documentType: field.optional(),
    storagePath: field.optional(),
    tags: z.object({ mode: fieldMode, allowNew: z.boolean().default(false) }).optional(),
    documentDate: field.optional(),
    title: field.optional(),
    customFields: z
      .array(
        z.object({
          definitionId: z.string(),
          mode: fieldMode,
          allowNewOptions: z.boolean().optional(),
        }),
      )
      .min(1)
      .optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, {
    message: "Enable at least one field",
  });

export type AiAssignParams = z.infer<typeof aiAssignParamsSchema>;

export type AiSuggestionValue =
  | { id: string }
  | { existingIds: string[]; newNames: string[] }
  | { value: string }
  | { selectOptionId: string }
  | { newOptionLabel: string };
