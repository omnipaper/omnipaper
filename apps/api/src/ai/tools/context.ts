import { z } from "zod";

// The context every tool receives programmatically from the caller, never from the model.
// Kept in a leaf module so tools and the registry share one schema without an import cycle.
export const aiToolContextSchema = z.object({ organizationId: z.string() });

export type AiToolContext = z.infer<typeof aiToolContextSchema>;
