import type { ActionResult, WorkflowAction } from "@omnipaper/shared/workflows";
import type { WorkflowRunContext } from "./context";
import { runAiAssign } from "./ai/assign";
import { runTagAction } from "./tag-actions";

// Dispatch one action to its executor. The discriminated union makes this exhaustive: a new action
// type won't compile until it's handled here.
export function runAction(
  action: WorkflowAction,
  ctx: WorkflowRunContext,
): Promise<ActionResult> {
  switch (action.type) {
    case "tag.add":
    case "tag.remove":
      return runTagAction(action, ctx);
    case "ai.assignMetadata":
      return runAiAssign(action, ctx);
  }
}
