import { z } from "zod";
import { filterStateSchema } from "../document-filters";
import { aiAssignParamsSchema } from "./ai-assign";
import { TRIGGER_IDS, type TriggerId } from "./triggers";

export const triggerSchema = z.object({
  type: z.enum(TRIGGER_IDS as [TriggerId, ...TriggerId[]]),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("tag.add"),
    config: z.object({ tagId: z.string() }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("tag.remove"),
    config: z.object({ tagId: z.string() }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("ai.assignMetadata"),
    config: aiAssignParamsSchema,
  }),
]);

export const workflowDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  trigger: triggerSchema,
  filter: filterStateSchema.optional(),
  actions: z.array(actionSchema).min(1),
});

export type WorkflowTrigger = z.infer<typeof triggerSchema>;
export type WorkflowAction = z.infer<typeof actionSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
