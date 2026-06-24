import { recordEvent } from "@omnipaper/database/activity";
import { db } from "@omnipaper/database/client";
import { buildDocumentWhere } from "@omnipaper/database/queries/document-filters";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import { addDocumentTag, getOrgTag, removeDocumentTag } from "@omnipaper/database/queries/tags";
import {
  finishWorkflowRun,
  getWorkflowById,
  insertWorkflowRun,
} from "@omnipaper/database/queries/workflows";
import { documents } from "@omnipaper/database/schema";
import { defineTask } from "@omnipaper/queue/worker";
import type { FilterState } from "@omnipaper/shared/document-filters";
import { type WorkflowAction, workflowDefinitionSchema } from "@omnipaper/shared/workflows/schema";
import { and, eq, sql } from "drizzle-orm";
import { runAiAssignMetadata } from "../lib/ai-assign";

type ActionResult = {
  actionId: string;
  type: WorkflowAction["type"];
  status: "ok" | "failed";
  detail?: string;
};

async function passesFilter(documentId: string, organizationId: string, filter?: FilterState) {
  if (!filter) {
    return true;
  }

  const [row] = await db
    .select({ ok: sql`1` })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId),
        ...buildDocumentWhere(filter),
      ),
    )
    .limit(1);

  return Boolean(row);
}

async function runAction(
  action: WorkflowAction,
  doc: {
    id: string;
    organizationId: string;
    title: string;
    ocrText: string | null;
    documentTypeId: string | null;
    storagePathId: string | null;
  },
): Promise<ActionResult> {
  switch (action.type) {
    case "tag.add": {
      const tag = await getOrgTag(db, {
        organizationId: doc.organizationId,
        id: action.config.tagId,
      });
      if (!tag) {
        return {
          actionId: action.id,
          type: action.type,
          status: "failed",
          detail: "tag not found",
        };
      }
      await addDocumentTag(db, { documentId: doc.id, tagId: action.config.tagId });
      return { actionId: action.id, type: action.type, status: "ok" };
    }
    case "tag.remove": {
      await removeDocumentTag(db, { documentId: doc.id, tagId: action.config.tagId });
      return { actionId: action.id, type: action.type, status: "ok" };
    }
    case "ai.assignMetadata": {
      const result = await runAiAssignMetadata(doc, action.config);
      return {
        actionId: action.id,
        type: action.type,
        status: result.ok ? "ok" : "failed",
        detail: result.detail,
      };
    }
  }
}

export const workflowRunTask = defineTask(
  "workflow-run",
  async ({ workflowId, documentId, triggerEventId }) => {
    const run = await insertWorkflowRun(db, { workflowId, documentId, triggerEventId });
    if (!run) {
      return;
    }

    const workflow = await getWorkflowById(db, { id: workflowId });
    const doc = await getDocumentById(db, { id: documentId });
    if (!workflow || !doc) {
      await finishWorkflowRun(db, { id: run.id, status: "skipped" });
      return;
    }

    const definition = workflowDefinitionSchema.parse(workflow.definition);

    if (!(await passesFilter(documentId, doc.organizationId, definition.filter))) {
      await finishWorkflowRun(db, { id: run.id, status: "skipped" });
      return;
    }

    const results: ActionResult[] = [];
    for (const action of definition.actions) {
      try {
        results.push(await runAction(action, doc));
      } catch (err) {
        results.push({
          actionId: action.id,
          type: action.type,
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const tagsChanged = results.some(
      (r) => r.status === "ok" && (r.type === "tag.add" || r.type === "tag.remove"),
    );
    if (tagsChanged) {
      await recordEvent(db, {
        organizationId: doc.organizationId,
        resource: { type: "document", id: doc.id, label: doc.title },
        event: "document.tags_updated",
        actor: { type: "system" },
        data: { workflowId },
      });
    }

    await finishWorkflowRun(db, {
      id: run.id,
      status: results.some((r) => r.status === "failed") ? "failed" : "succeeded",
      actionResults: results,
    });
  },
);
