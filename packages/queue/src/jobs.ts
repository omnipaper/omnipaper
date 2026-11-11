import type { TaskSpec } from "graphile-worker";
import { z } from "zod";

type JobDefinition = { schema: z.ZodType; spec: TaskSpec };

export const JOB_DEFINITIONS = {
  "ocr-extract": {
    schema: z.object({ documentId: z.string().min(1) }),
    spec: { maxAttempts: 5, queueName: "ocr" },
  },
  "text-extract": {
    schema: z.object({ documentId: z.string().min(1) }),
    spec: { maxAttempts: 10 },
  },
  "thumbnail-generate": {
    schema: z.object({ documentId: z.string().min(1) }),
    spec: { maxAttempts: 10 },
  },
  "workflow-dispatch": {
    schema: z.object({
      documentId: z.string().min(1),
      trigger: z.string().min(1),
      triggerEventId: z.string().min(1),
    }),
    spec: { maxAttempts: 5 },
  },
  "workflow-run": {
    schema: z.object({
      workflowId: z.string().min(1),
      documentId: z.string().min(1),
      triggerEventId: z.string().min(1),
    }),
    spec: { maxAttempts: 3, queueName: "ai" },
  },
  // Cron fan-out: dispatch finds enabled accounts and enqueues one email-poll per account,
  // so one broken mailbox never blocks the others. No retry for the dispatcher (the next cron
  // tick is the retry).
  "email-poll-dispatch": {
    schema: z.object({}),
    spec: { maxAttempts: 1 },
  },
  // Polls share one serial queue so the same mailbox is never polled concurrently.
  "email-poll": {
    schema: z.object({ accountId: z.string().min(1) }),
    spec: { maxAttempts: 3, queueName: "email" },
  },
} satisfies Record<string, JobDefinition>;

export type JobName = keyof typeof JOB_DEFINITIONS;

export type JobPayload<TName extends JobName> = z.infer<(typeof JOB_DEFINITIONS)[TName]["schema"]>;
