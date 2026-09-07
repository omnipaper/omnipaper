import { db } from "@omnipaper/database/client";
import { recordFieldChanges } from "@omnipaper/database/field-changes";
import { documentMatchesFilter } from "@omnipaper/database/queries/document-filters";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import {
  addDocumentTag,
  getOrgTag,
  getTagsByDocumentIds,
  removeDocumentTag,
} from "@omnipaper/database/queries/tags";
import {
  finishWorkflowRun,
  getWorkflowById,
  insertWorkflowRun,
} from "@omnipaper/database/queries/workflows";
import { defineTask } from "@omnipaper/queue/worker";
import { type WorkflowAction, workflowDefinitionSchema } from "@omnipaper/shared/workflows/schema";
import { runAiAssignMetadata } from "../lib/ai-assign";
import { taskLogger } from "../logger";

type ActionResult = {
  actionId: string;
  type: WorkflowAction["type"];
  status: "ok" | "failed";
  detail?: string;
};

async function runAction(
  action: WorkflowAction,
  doc: {
    id: string;
    organizationId: string;
    title: string;
    ocrText: string | null;
    documentTypeId: string | null;
    storagePathId: string | null;
    documentDate: string | null;
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
      const current = await getTagsByDocumentIds(db, { documentIds: [doc.id] });
      await addDocumentTag(db, { documentId: doc.id, tagId: tag.id });
      if (!current.some((t) => t.id === tag.id)) {
        await recordFieldChanges(db, {
          documentId: doc.id,
          source: "ai",
          changes: [{ field: "tags", newValue: { id: tag.id, name: tag.name } }],
        });
      }
      return { actionId: action.id, type: action.type, status: "ok" };
    }
    case "tag.remove": {
      const current = await getTagsByDocumentIds(db, { documentIds: [doc.id] });
      const attached = current.find((t) => t.id === action.config.tagId);
      await removeDocumentTag(db, { documentId: doc.id, tagId: action.config.tagId });
      if (attached) {
        await recordFieldChanges(db, {
          documentId: doc.id,
          source: "ai",
          changes: [{ field: "tags", oldValue: { id: attached.id, name: attached.name } }],
        });
      }
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

    const matches = await documentMatchesFilter(db, {
      documentId,
      organizationId: doc.organizationId,
      filter: definition.filter,
    });

    if (!matches) {
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

    const failed = results.filter((r) => r.status === "failed");
    await finishWorkflowRun(db, {
      id: run.id,
      status: failed.length > 0 ? "failed" : "succeeded",
      actionResults: results,
    });
    if (failed.length > 0) {
      const details = failed.map((r) => `${r.type}: ${r.detail ?? "unknown error"}`).join("; ");
      taskLogger.error(
        { workflowId, workflowName: workflow.name, documentId, details },
        "workflow actions failed",
      );
    }
  },
);
