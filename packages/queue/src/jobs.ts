import { z } from "zod";

export const jobSchemas = {
  "ocr-extract": z.object({ documentId: z.string().min(1) }),
  "text-extract": z.object({ documentId: z.string().min(1) }),
  "thumbnail-generate": z.object({ documentId: z.string().min(1) }),
  "workflow-dispatch": z.object({
    documentId: z.string().min(1),
    trigger: z.string().min(1),
    triggerEventId: z.string().min(1),
  }),
  "workflow-run": z.object({
    workflowId: z.string().min(1),
    documentId: z.string().min(1),
    triggerEventId: z.string().min(1),
  }),
} as const;

export type JobName = keyof typeof jobSchemas;

export type JobPayload<TName extends JobName> = z.infer<(typeof jobSchemas)[TName]>;
