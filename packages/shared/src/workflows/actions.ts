// The actions a workflow can run, in order. Same registry pattern as triggers.ts: one frozen
// record drives the builder, the Zod schema, and the executor. `requiresText` is load-bearing in
// the UI — an action that needs extracted text (ai.assignMetadata) forces a text-bearing trigger.

export const ACTION_IDS = ["tag.add", "tag.remove", "ai.assignMetadata"] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type ActionDefinition = {
  id: ActionId;
  label: string;
  // Needs the document's extracted text to run. Gates trigger choice in the builder and is enforced
  // by the workflow definition schema (an AI action can't sit on document.created).
  requiresText: boolean;
};

export const ACTION_DEFINITIONS = {
  "tag.add": { id: "tag.add", label: "Add a tag", requiresText: false },
  "tag.remove": { id: "tag.remove", label: "Remove a tag", requiresText: false },
  "ai.assignMetadata": {
    id: "ai.assignMetadata",
    label: "Let AI assign metadata",
    requiresText: true,
  },
} as const satisfies Record<ActionId, ActionDefinition>;

export function getActionDefinition(id: ActionId): ActionDefinition {
  return ACTION_DEFINITIONS[id];
}

export function isActionId(id: string): id is ActionId {
  return id in ACTION_DEFINITIONS;
}

export function listActionDefinitions(): ActionDefinition[] {
  return Object.values(ACTION_DEFINITIONS);
}
