import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { type NewWorkflow, workflowRuns, workflows } from "../schema";

export type GetOrgWorkflowsParams = {
  organizationId: string;
};

export type GetOrgWorkflowParams = {
  organizationId: string;
  id: string;
};

export type GetWorkflowByIdParams = {
  id: string;
};

export type GetEnabledWorkflowsByTriggerParams = {
  organizationId: string;
  triggerType: string;
};

export type CreateWorkflowInput = {
  organizationId: string;
  name: string;
  triggerType: string;
  definition: NewWorkflow["definition"];
  enabled?: boolean;
  origin?: NewWorkflow["origin"];
};

export type UpdateWorkflowInput = {
  organizationId: string;
  id: string;
  name?: string;
  enabled?: boolean;
  triggerType?: string;
  definition?: NewWorkflow["definition"];
};

export type DeleteWorkflowParams = {
  organizationId: string;
  id: string;
};

export type InsertWorkflowRunInput = {
  workflowId: string;
  documentId: string;
  triggerEventId: string;
};

export type FinishWorkflowRunInput = {
  id: string;
  status: "succeeded" | "failed" | "skipped";
  actionResults?: unknown;
  error?: { message: string } | null;
};

export async function getOrgWorkflows(db: Database, params: GetOrgWorkflowsParams) {
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.organizationId, params.organizationId))
    .orderBy(desc(workflows.createdAt));
}

export async function getOrgWorkflow(db: Database, params: GetOrgWorkflowParams) {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, params.id), eq(workflows.organizationId, params.organizationId)))
    .limit(1);

  return workflow;
}

export async function getWorkflowById(db: Database, params: GetWorkflowByIdParams) {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, params.id))
    .limit(1);

  return workflow;
}

export async function getEnabledWorkflowsByTrigger(
  db: Database,
  params: GetEnabledWorkflowsByTriggerParams,
) {
  return db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.organizationId, params.organizationId),
        eq(workflows.triggerType, params.triggerType),
        eq(workflows.enabled, true),
      ),
    );
}

export async function createWorkflow(db: Database, input: CreateWorkflowInput) {
  const [workflow] = await db
    .insert(workflows)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      definition: input.definition,
      enabled: input.enabled ?? false,
      origin: input.origin ?? "user",
    })
    .returning();

  if (!workflow) {
    throw new Error("Failed to create workflow");
  }

  return workflow;
}

export async function updateWorkflow(db: Database, input: UpdateWorkflowInput) {
  const patch: Partial<Pick<NewWorkflow, "name" | "enabled" | "triggerType" | "definition">> = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.enabled !== undefined) {
    patch.enabled = input.enabled;
  }
  if (input.triggerType !== undefined) {
    patch.triggerType = input.triggerType;
  }
  if (input.definition !== undefined) {
    patch.definition = input.definition;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgWorkflow(db, { organizationId: input.organizationId, id: input.id });
  }

  const [workflow] = await db
    .update(workflows)
    .set(patch)
    .where(and(eq(workflows.id, input.id), eq(workflows.organizationId, input.organizationId)))
    .returning();

  return workflow;
}

export async function deleteWorkflow(db: Database, params: DeleteWorkflowParams) {
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, params.id), eq(workflows.organizationId, params.organizationId)));
}

export async function insertWorkflowRun(db: Database, input: InsertWorkflowRunInput) {
  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowId: input.workflowId,
      documentId: input.documentId,
      triggerEventId: input.triggerEventId,
      status: "running",
    })
    .onConflictDoNothing({ target: [workflowRuns.workflowId, workflowRuns.triggerEventId] })
    .returning();

  return run ?? null;
}

export async function finishWorkflowRun(db: Database, input: FinishWorkflowRunInput) {
  await db
    .update(workflowRuns)
    .set({
      status: input.status,
      actionResults: input.actionResults,
      error: input.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(workflowRuns.id, input.id));
}
