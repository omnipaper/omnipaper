import type { Workflow } from "@omnipaper/database/schema";

// The workflow envelope for the API: the row plus its parsed definition. Single source for both the
// builder list (origin='user') and the AI settings front door (the system workflow's fields config).
export function toWorkflowDto(workflow: Workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    enabled: workflow.enabled,
    origin: workflow.origin,
    triggerType: workflow.triggerType,
    schemaVersion: workflow.schemaVersion,
    definition: workflow.definition,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}
