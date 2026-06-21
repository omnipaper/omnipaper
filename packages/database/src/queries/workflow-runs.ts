import type { ActionResult } from "@omnipaper/shared/workflows";
import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { type WorkflowRun, workflowRuns } from "../schema";

// Audit + exactly-once for workflow runs. The dedup lives in the DB: claiming a run is an insert
// guarded by the unique (workflowId, triggerEventId) constraint.

export type ClaimWorkflowRunParams = {
  workflowId: string;
  documentId: string;
  triggerEventId: string;
};

// Claim this trigger fire for this workflow. Returns the run to execute, or null to skip:
//   • fresh insert            → execute (the common path).
//   • conflict, status=running → a prior attempt of THIS job crashed/threw and graphile-worker is
//                                retrying; resume by returning the existing row (re-runs the actions).
//   • conflict, status=terminal → a genuine duplicate delivery of a finished run; skip (null).
// This is what makes the dedup coexist with graphile's own retries: a retry resumes, a duplicate skips.
export async function claimWorkflowRun(
  db: Database,
  params: ClaimWorkflowRunParams,
): Promise<WorkflowRun | null> {
  const [inserted] = await db
    .insert(workflowRuns)
    .values({
      workflowId: params.workflowId,
      documentId: params.documentId,
      triggerEventId: params.triggerEventId,
      status: "running",
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return inserted;
  }

  const [existing] = await db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.workflowId, params.workflowId),
        eq(workflowRuns.triggerEventId, params.triggerEventId),
      ),
    )
    .limit(1);

  if (!existing) {
    return null;
  }

  return existing.status === "running" ? existing : null;
}

export type FinishWorkflowRunParams = {
  id: string;
  status: WorkflowRun["status"];
  actionResults?: ActionResult[];
  error?: { message: string };
};

export async function finishWorkflowRun(db: Database, params: FinishWorkflowRunParams) {
  await db
    .update(workflowRuns)
    .set({
      status: params.status,
      actionResults: params.actionResults,
      error: params.error,
      finishedAt: new Date(),
    })
    .where(eq(workflowRuns.id, params.id));
}
