import { db } from "@omnipaper/database/client";
import {
  createWorkflow,
  getOrgSystemWorkflow,
  getOrgWorkflows,
  updateWorkflow,
} from "@omnipaper/database/queries/workflows";
import type { Workflow } from "@omnipaper/database/schema";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import type { WorkflowDefinition } from "@omnipaper/shared/workflows/schema";

const TRIGGER = "document.ocr_completed";
const SYSTEM_KEY = "ai-assign";
const ACTION_ID = "ai-assign";

type FieldMode = "suggest" | "apply";

export type AiAssignView = {
  workflowId: string;
  enabled: boolean;
  fields: {
    documentType: { enabled: boolean; mode: FieldMode };
    storagePath: { enabled: boolean; mode: FieldMode };
    tags: { enabled: boolean; mode: FieldMode; allowNew: boolean };
    title: { enabled: boolean; mode: FieldMode };
    documentDate: { enabled: boolean; mode: FieldMode };
  };
  customFields: { definitionId: string; mode: FieldMode; allowNewOptions: boolean }[];
};

function buildDefinition(config: AiAssignParams): WorkflowDefinition {
  return {
    schemaVersion: 1,
    trigger: { type: TRIGGER, config: {} },
    actions: [{ id: ACTION_ID, type: "ai.assignMetadata", config }],
  };
}

async function getOrCreate(organizationId: string): Promise<Workflow> {
  const existing = await getOrgSystemWorkflow(db, { organizationId, systemKey: SYSTEM_KEY });
  if (existing) {
    return existing;
  }
  return createWorkflow(db, {
    organizationId,
    name: "AI metadata",
    triggerType: TRIGGER,
    definition: buildDefinition({}),
    enabled: false,
    systemKey: SYSTEM_KEY,
  });
}

function readConfig(workflow: Workflow): AiAssignParams {
  const action = workflow.definition.actions.find((a) => a.type === "ai.assignMetadata");
  return action?.type === "ai.assignMetadata" ? action.config : {};
}

function toView(workflow: Workflow): AiAssignView {
  const config = readConfig(workflow);
  const field = (value?: { mode: FieldMode }) => ({
    enabled: Boolean(value),
    mode: value?.mode ?? "suggest",
  });
  return {
    workflowId: workflow.id,
    enabled: workflow.enabled,
    fields: {
      documentType: field(config.documentType),
      storagePath: field(config.storagePath),
      tags: {
        enabled: Boolean(config.tags),
        mode: config.tags?.mode ?? "suggest",
        allowNew: config.tags?.allowNew ?? false,
      },
      title: field(config.title),
      documentDate: field(config.documentDate),
    },
    customFields: (config.customFields ?? []).map((e) => ({
      definitionId: e.definitionId,
      mode: e.mode,
      allowNewOptions: e.allowNewOptions ?? false,
    })),
  };
}

export async function getSystemAiAssign(organizationId: string): Promise<AiAssignView> {
  return toView(await getOrCreate(organizationId));
}

export async function setSystemAiAssign(
  organizationId: string,
  patch: Partial<AiAssignParams>,
): Promise<AiAssignView> {
  const workflow = await getOrCreate(organizationId);
  const config: AiAssignParams = { ...readConfig(workflow), ...patch };
  for (const key of Object.keys(patch) as (keyof AiAssignParams)[]) {
    if (patch[key] === undefined) {
      delete config[key];
    }
  }
  const updated = await updateWorkflow(db, {
    organizationId,
    id: workflow.id,
    enabled: Object.keys(config).length > 0,
    definition: buildDefinition(config),
  });
  return toView(updated ?? workflow);
}

export async function setSystemAiAssignCustomField(
  organizationId: string,
  definitionId: string,
  enabled: boolean,
): Promise<AiAssignView> {
  const workflow = await getOrCreate(organizationId);
  const current = readConfig(workflow).customFields ?? [];
  const entries = enabled
    ? current.some((e) => e.definitionId === definitionId)
      ? current
      : [...current, { definitionId, mode: "suggest" as const }]
    : current.filter((e) => e.definitionId !== definitionId);
  return setSystemAiAssign(organizationId, {
    customFields: entries.length > 0 ? entries : undefined,
  });
}

// A deleted definition would otherwise linger as a dead id inside workflow JSON (harmless to the
// engine, but it would read as "enabled" in the settings UI).
export async function removeCustomFieldFromWorkflows(
  organizationId: string,
  definitionId: string,
): Promise<void> {
  const all = await getOrgWorkflows(db, { organizationId });
  for (const workflow of all) {
    let changed = false;
    const actions = workflow.definition.actions.map((action) => {
      if (action.type !== "ai.assignMetadata" || !action.config.customFields) {
        return action;
      }
      const entries = action.config.customFields.filter((e) => e.definitionId !== definitionId);
      if (entries.length === action.config.customFields.length) {
        return action;
      }
      changed = true;
      const config = { ...action.config };
      if (entries.length > 0) {
        config.customFields = entries;
      } else {
        delete config.customFields;
      }
      return { ...action, config };
    });
    if (!changed) {
      continue;
    }
    const emptySystemConfig =
      workflow.systemKey === SYSTEM_KEY &&
      actions.every((a) => a.type !== "ai.assignMetadata" || Object.keys(a.config).length === 0);
    await updateWorkflow(db, {
      organizationId,
      id: workflow.id,
      ...(emptySystemConfig ? { enabled: false } : {}),
      definition: { ...workflow.definition, actions },
    });
  }
}
