export type ActionDefinition = {
  id: string;
  label: string;
  requiresText: boolean;
};

export const ACTION_DEFINITIONS = {
  "tag.add": { id: "tag.add", label: "Add tag", requiresText: false },
  "tag.remove": { id: "tag.remove", label: "Remove tag", requiresText: false },
  "ai.assignMetadata": {
    id: "ai.assignMetadata",
    label: "AI: assign metadata",
    requiresText: true,
  },
} as const satisfies Record<string, ActionDefinition>;

export type ActionId = keyof typeof ACTION_DEFINITIONS;

export const ACTION_IDS = Object.keys(ACTION_DEFINITIONS) as ActionId[];
