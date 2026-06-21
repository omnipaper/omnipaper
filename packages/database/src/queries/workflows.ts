import type { FilterState } from "@omnipaper/shared/document-filters";
import type { WorkflowDefinition } from "@omnipaper/shared/workflows";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import type { Database } from "../client";
import { documents, type Workflow, workflows } from "../schema";
import { buildDocumentWhere, type CustomPropertyTypeMap } from "./document-filters";

// All data access for the `workflows` domain. db-first (route, worker, or test) like the rest. The
// denormalised `triggerType`/`schemaVersion` columns are always derived from the definition here so
// they can never drift from the JSON.

export type GetOrgWorkflowsParams = { organizationId: string };

// User-facing builder list: the system workflow is edited through the AI settings front door, not
// the builder, so it's excluded here.
export async function getOrgWorkflows(db: Database, params: GetOrgWorkflowsParams) {
  return db
    .select()
    .from(workflows)
    .where(and(eq(workflows.organizationId, params.organizationId), eq(workflows.origin, "user")))
    .orderBy(desc(workflows.createdAt));
}

export type GetOrgWorkflowParams = { organizationId: string; id: string };

export async function getOrgWorkflow(db: Database, params: GetOrgWorkflowParams) {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, params.id), eq(workflows.organizationId, params.organizationId)))
    .limit(1);

  return workflow;
}

// By id only — the worker resolves a workflow it was handed by the dispatcher, no org in scope.
export async function getWorkflowById(db: Database, params: { id: string }) {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, params.id))
    .limit(1);

  return workflow;
}

// The single system workflow whose `fields` config the AI settings front door reads/writes.
export async function getOrgSystemWorkflow(db: Database, params: { organizationId: string }) {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(
      and(eq(workflows.organizationId, params.organizationId), eq(workflows.origin, "system")),
    )
    .limit(1);

  return workflow;
}

// The dispatcher's cheap, indexed lookup: which enabled workflows in this org listen to this event?
// Backed by workflows_org_trigger_enabled_idx.
export async function getEnabledWorkflowsForTrigger(
  db: Database,
  params: { organizationId: string; triggerType: string },
): Promise<{ id: string }[]> {
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

export type CreateWorkflowInput = {
  organizationId: string;
  name: string;
  enabled?: boolean;
  origin?: Workflow["origin"];
  definition: WorkflowDefinition;
};

export async function createWorkflow(db: Database, input: CreateWorkflowInput) {
  const [workflow] = await db
    .insert(workflows)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      enabled: input.enabled ?? false,
      origin: input.origin ?? "user",
      triggerType: input.definition.trigger.type,
      schemaVersion: input.definition.schemaVersion,
      definition: input.definition,
    })
    .returning();

  if (!workflow) {
    throw new Error("Failed to create workflow");
  }

  return workflow;
}

export type UpdateWorkflowInput = {
  organizationId: string;
  id: string;
  name?: string;
  enabled?: boolean;
  definition?: WorkflowDefinition;
};

export async function updateWorkflow(db: Database, input: UpdateWorkflowInput) {
  const patch: Partial<typeof workflows.$inferInsert> = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.enabled !== undefined) {
    patch.enabled = input.enabled;
  }
  if (input.definition !== undefined) {
    patch.definition = input.definition;
    patch.triggerType = input.definition.trigger.type;
    patch.schemaVersion = input.definition.schemaVersion;
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

// Front-door create-or-update of the org's single system workflow. Wrapped in a transaction; the
// partial unique index (workflows_org_system_unique) is the backstop against a race.
export type UpsertSystemWorkflowInput = {
  organizationId: string;
  name: string;
  enabled: boolean;
  definition: WorkflowDefinition;
};

export async function upsertSystemWorkflow(db: Database, input: UpsertSystemWorkflowInput) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(eq(workflows.organizationId, input.organizationId), eq(workflows.origin, "system")),
      )
      .limit(1);

    const values = {
      name: input.name.trim(),
      enabled: input.enabled,
      definition: input.definition,
      triggerType: input.definition.trigger.type,
      schemaVersion: input.definition.schemaVersion,
    };

    const [workflow] = existing
      ? await tx.update(workflows).set(values).where(eq(workflows.id, existing.id)).returning()
      : await tx
          .insert(workflows)
          .values({ organizationId: input.organizationId, origin: "system", ...values })
          .returning();

    if (!workflow) {
      throw new Error("Failed to upsert system workflow");
    }

    return workflow;
  });
}

export async function deleteWorkflow(
  db: Database,
  params: { organizationId: string; id: string },
) {
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, params.id), eq(workflows.organizationId, params.organizationId)));
}

// Does this one document pass the workflow's filter? Reuses buildDocumentWhere so the workflow
// filter has exactly the same semantics as the document list filter — never a second evaluator.
export async function documentMatchesFilter(
  db: Database,
  params: {
    documentId: string;
    organizationId: string;
    filter?: FilterState;
    cpTypes?: CustomPropertyTypeMap;
  },
): Promise<boolean> {
  if (!params.filter || Object.keys(params.filter).length === 0) {
    return true;
  }

  const conditions = buildDocumentWhere(params.filter, params.cpTypes).filter(
    (condition): condition is SQL => condition !== undefined,
  );

  const [row] = await db
    .select({ ok: sql`1` })
    .from(documents)
    .where(
      and(
        eq(documents.id, params.documentId),
        eq(documents.organizationId, params.organizationId),
        ...conditions,
      ),
    )
    .limit(1);

  return Boolean(row);
}
