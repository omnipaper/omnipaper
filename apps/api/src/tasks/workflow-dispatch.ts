import { db } from "@omnipaper/database/client";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import { getEnabledWorkflowsForTrigger } from "@omnipaper/database/queries/workflows";
import { enqueue } from "@omnipaper/queue/producer";
import { defineTask } from "@omnipaper/queue/worker";

// Fan-out: one trigger fire → a run job per enabled workflow listening to it. The triggerEventId is
// threaded through unchanged so every run dedups against the same fire (exactly-once via workflow_runs).
export const workflowDispatchTask = defineTask(
  "workflow-dispatch",
  async ({ documentId, trigger, triggerEventId }) => {
    const doc = await getDocumentById(db, { id: documentId });
    if (!doc) {
      return;
    }

    const matching = await getEnabledWorkflowsForTrigger(db, {
      organizationId: doc.organizationId,
      triggerType: trigger,
    });

    for (const workflow of matching) {
      await enqueue("workflow-run", { workflowId: workflow.id, documentId, triggerEventId });
    }
  },
);
