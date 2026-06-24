import { db } from "@omnipaper/database/client";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import { getEnabledWorkflowsByTrigger } from "@omnipaper/database/queries/workflows";
import { enqueue } from "@omnipaper/queue/producer";
import { defineTask } from "@omnipaper/queue/worker";

export const workflowDispatchTask = defineTask(
  "workflow-dispatch",
  async ({ documentId, trigger, triggerEventId }) => {
    const doc = await getDocumentById(db, { id: documentId });
    if (!doc) {
      return;
    }

    const workflows = await getEnabledWorkflowsByTrigger(db, {
      organizationId: doc.organizationId,
      triggerType: trigger,
    });

    for (const workflow of workflows) {
      await enqueue("workflow-run", { workflowId: workflow.id, documentId, triggerEventId });
    }
  },
);
