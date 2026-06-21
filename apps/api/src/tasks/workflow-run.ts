import { AiError } from "@omnipaper/ai/resolve";
import { db } from "@omnipaper/database/client";
import { getOrgCustomPropertyTypes } from "@omnipaper/database/queries/custom-properties";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import { claimWorkflowRun, finishWorkflowRun } from "@omnipaper/database/queries/workflow-runs";
import { documentMatchesFilter, getWorkflowById } from "@omnipaper/database/queries/workflows";
import { defineTask } from "@omnipaper/queue/worker";
import { type ActionResult, workflowDefinitionSchema } from "@omnipaper/shared/workflows";
import { runAction } from "../workflows/runner";

// Execute one workflow against one document for one trigger fire. Serialised on the "ai" queue (the
// paid lane). Exactly-once + retry-resume is handled by claimWorkflowRun (see workflow-runs.ts).
export const workflowRunTask = defineTask(
  "workflow-run",
  async ({ workflowId, documentId, triggerEventId }, helpers) => {
    const run = await claimWorkflowRun(db, { workflowId, documentId, triggerEventId });
    if (!run) {
      return; // already claimed by a finished run — duplicate delivery, no-op.
    }

    const workflow = await getWorkflowById(db, { id: workflowId });
    const document = await getDocumentById(db, { id: documentId });
    if (!workflow || !document) {
      await finishWorkflowRun(db, { id: run.id, status: "skipped" });
      return;
    }

    const parsed = workflowDefinitionSchema.safeParse(workflow.definition);
    if (!parsed.success) {
      await finishWorkflowRun(db, {
        id: run.id,
        status: "failed",
        error: { message: "Invalid workflow definition" },
      });
      return;
    }
    const definition = parsed.data;

    // Filter reuses the document-list resolver, so workflow filters and list filters are identical.
    // Only resolve custom-property types when the filter actually references a cp: key.
    const filter = definition.filter;
    const cpTypes =
      filter && Object.keys(filter).some((key) => key.startsWith("cp:"))
        ? new Map(
            (await getOrgCustomPropertyTypes(db, { organizationId: document.organizationId })).map(
              (d) => [d.id, d.type] as const,
            ),
          )
        : undefined;

    const passes = await documentMatchesFilter(db, {
      documentId,
      organizationId: document.organizationId,
      filter,
      cpTypes,
    });
    if (!passes) {
      await finishWorkflowRun(db, { id: run.id, status: "skipped" });
      return;
    }

    const ctx = { db, document, workflowId, runId: run.id };
    const results: ActionResult[] = [];

    for (const action of definition.actions) {
      try {
        results.push(await runAction(action, ctx));
      } catch (err) {
        // A transient AI error rethrows so graphile retries — the run row stays "running" and the
        // next attempt resumes via claimWorkflowRun. On the last attempt (or a deterministic error)
        // we record the failure and continue; actions are independent.
        if (
          err instanceof AiError &&
          err.retryable &&
          helpers.job.attempts < helpers.job.max_attempts
        ) {
          throw err;
        }
        results.push({
          actionId: action.id,
          type: action.type,
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await finishWorkflowRun(db, { id: run.id, status: summarize(results), actionResults: results });
  },
);

function summarize(results: ActionResult[]): "succeeded" | "failed" | "skipped" {
  if (results.some((r) => r.status === "failed")) {
    return "failed";
  }
  if (results.length > 0 && results.every((r) => r.status === "skipped")) {
    return "skipped";
  }
  return "succeeded";
}
