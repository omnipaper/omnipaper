import { z } from "zod";

const fieldMode = z.enum(["auto", "suggest"]);
const field = z.object({ mode: fieldMode });

export const aiAssignParamsSchema = z
  .object({
    documentType: field.optional(),
    storagePath: field.optional(),
    tags: z.object({ mode: fieldMode, allowNew: z.boolean().default(false) }).optional(),
    documentDate: field.optional(),
    title: field.optional(),
    customFields: z
      .object({ mode: fieldMode, definitionIds: z.array(z.string()).min(1) })
      .optional(),
  })
  .refine((fields) => Object.keys(fields).length > 0, {
    message: "Enable at least one field",
  });

export type AiAssignParams = z.infer<typeof aiAssignParamsSchema>;
