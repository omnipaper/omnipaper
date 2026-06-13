import { z } from "zod";

export const jobSchemas = {
  "ocr-extract": z.object({ documentId: z.string().min(1) }),
  "migration-analyze": z.object({ migrationId: z.string().min(1) }),
  "migration-ingest": z.object({ migrationId: z.string().min(1) }),
} as const;

export type JobName = keyof typeof jobSchemas;

export type JobPayload<TName extends JobName> = z.infer<(typeof jobSchemas)[TName]>;
