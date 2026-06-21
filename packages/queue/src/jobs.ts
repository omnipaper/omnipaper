import { TRIGGER_IDS } from "@omnipaper/shared/workflows";
import { z } from "zod";

export const jobSchemas = {
  "ocr-extract": z.object({ documentId: z.string().min(1) }),
  "text-extract": z.object({ documentId: z.string().min(1) }),
  "thumbnail-generate": z.object({ documentId: z.string().min(1) }),
  // Fan-out step: find the enabled workflows listening to this trigger and enqueue a run for each.
  // triggerEventId is minted at the emission point (one per trigger fire) and threaded through so
  // each run can dedup itself (exactly-once via workflow_runs).
  "workflow-dispatch": z.object({
    documentId: z.string().min(1),
    trigger: z.enum(TRIGGER_IDS),
    triggerEventId: z.string().min(1),
  }),
  // Execute one workflow against one document for one trigger fire.
  "workflow-run": z.object({
    workflowId: z.string().min(1),
    documentId: z.string().min(1),
    triggerEventId: z.string().min(1),
  }),
} as const;

export type JobName = keyof typeof jobSchemas;

export type JobPayload<TName extends JobName> = z.infer<(typeof jobSchemas)[TName]>;
