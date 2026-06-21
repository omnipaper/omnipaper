import { createId } from "@omnipaper/database/id";
import { enqueue } from "@omnipaper/queue/producer";
import type { TriggerId } from "@omnipaper/shared/workflows";

// Single emission point for workflow triggers. Lives in the app layer (not @omnipaper/database) on
// purpose: the database package must never depend on the queue, or the dependency graph inverts.
//
// A fresh triggerEventId per fire means a manual re-OCR genuinely re-runs workflows, while a
// duplicate delivery of the same job (same id) is deduped by workflow_runs. Swallows its own errors:
// a failed enqueue must not fail the upstream operation (ingest, OCR) that just succeeded.
export async function dispatchWorkflowTrigger(
  documentId: string,
  trigger: TriggerId,
): Promise<void> {
  try {
    await enqueue("workflow-dispatch", {
      documentId,
      trigger,
      triggerEventId: createId("wfe"),
    });
  } catch (error) {
    console.error(`[workflows] failed to dispatch ${trigger} for document ${documentId}:`, error);
  }
}
