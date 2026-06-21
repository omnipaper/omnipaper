import type { ActionId } from "./actions";

// Per-action outcome recorded on a workflow_run row for auditing/debugging. Actions are independent:
// one failing doesn't abort the run, it's recorded here and the run continues to the next action.
export type ActionResultStatus = "applied" | "skipped" | "failed";

export type ActionResult = {
  actionId: string;
  type: ActionId;
  status: ActionResultStatus;
  // Human-readable note: what was applied, why it was skipped, or the (redacted) failure message.
  detail?: string;
};
