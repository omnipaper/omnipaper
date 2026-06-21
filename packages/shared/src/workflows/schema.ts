import { z } from "zod";
import { filterStateSchema } from "../document-filters";
import { ACTION_DEFINITIONS } from "./actions";
import { aiAssignParamsSchema } from "./ai-assign";
import { TRIGGER_DEFINITIONS, TRIGGER_IDS } from "./triggers";

// The workflow JSON DSL. A definition is LINEAR: a trigger, an optional filter, and an ordered list
// of actions — array order IS execution order, no graph/connections. Keeping it as validated JSON
// is the whole point: the same Zod schema validates UI edits, builder edits, and AI-authored JSON,
// and `z.toJSONSchema(workflowDefinitionSchema)` is handed to an LLM to author workflows.

export const WORKFLOW_SCHEMA_VERSION = 1;

export const triggerSchema = z.object({
  type: z.enum(TRIGGER_IDS),
  // Reserved for future triggers that carry config (cron expression, mailbox, …). Empty today.
  config: z.record(z.string(), z.unknown()).default({}),
});

export type WorkflowTrigger = z.infer<typeof triggerSchema>;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("tag.add"),
    config: z.object({ tagId: z.string().min(1) }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("tag.remove"),
    config: z.object({ tagId: z.string().min(1) }),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("ai.assignMetadata"),
    config: aiAssignParamsSchema,
  }),
]);

export type WorkflowAction = z.infer<typeof actionSchema>;

export const workflowDefinitionSchema = z
  .object({
    // bump-and-break: an upcaster is only needed once the shape changes, not before.
    schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION),
    trigger: triggerSchema,
    // Optional filter reuses the document list's FilterState verbatim (implicit-AND map of
    // fieldKey → FilterValue). Absent filter = the workflow runs on every trigger fire.
    filter: filterStateSchema.optional(),
    actions: z.array(actionSchema).min(1),
  })
  .superRefine((definition, ctx) => {
    // A text-requiring action (ai.assignMetadata) can't sit on a trigger that fires before text
    // exists (document.created). The builder greys this out; the schema makes it impossible to save.
    const triggerProvidesText = TRIGGER_DEFINITIONS[definition.trigger.type].textAvailable;
    if (triggerProvidesText) {
      return;
    }
    definition.actions.forEach((action, index) => {
      if (ACTION_DEFINITIONS[action.type].requiresText) {
        ctx.addIssue({
          code: "custom",
          path: ["actions", index, "type"],
          message: `"${ACTION_DEFINITIONS[action.type].label}" needs extracted text — use the "document processed" trigger`,
        });
      }
    });
  });

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
