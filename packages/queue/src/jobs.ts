import { z } from "zod";

export const jobSchemas = {
  "ocr-extract": z.object({ documentId: z.string().min(1) }),
  // Migration phases. The tasks themselves (and their registration in the worker's taskList) land
  // with the migration engine; the schemas are here so enqueue() can validate payloads.
  "migration-analyze": z.object({ migrationId: z.string().min(1) }),
  "migration-ingest": z.object({ migrationId: z.string().min(1) }),
} as const;

export type JobName = keyof typeof jobSchemas;

export type JobPayload<TName extends JobName> = z.infer<(typeof jobSchemas)[TName]>;
