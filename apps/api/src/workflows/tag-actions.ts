import { recordEvent } from "@omnipaper/database/activity";
import {
  addDocumentTags,
  getOrgTag,
  removeDocumentTags,
} from "@omnipaper/database/queries/tags";
import type { ActionResult, WorkflowAction } from "@omnipaper/shared/workflows";
import type { WorkflowRunContext } from "./context";

type TagAction = Extract<WorkflowAction, { type: "tag.add" | "tag.remove" }>;

// tag.add / tag.remove: free + idempotent, so they prove the engine end-to-end before AI lands. The
// tag is resolved (and org-scoped) first; a missing/foreign tag is a clean skip, not a failure.
export async function runTagAction(
  action: TagAction,
  ctx: WorkflowRunContext,
): Promise<ActionResult> {
  const { db, document } = ctx;

  const tag = await getOrgTag(db, {
    organizationId: document.organizationId,
    id: action.config.tagId,
  });

  if (!tag) {
    return {
      actionId: action.id,
      type: action.type,
      status: "skipped",
      detail: "Tag not found in this organization",
    };
  }

  if (action.type === "tag.add") {
    await addDocumentTags(db, { documentId: document.id, tagIds: [tag.id] });
  } else {
    await removeDocumentTags(db, { documentId: document.id, tagIds: [tag.id] });
  }

  await recordEvent(db, {
    organizationId: document.organizationId,
    resource: { type: "document", id: document.id, label: document.title },
    event: "document.tags_updated",
    actor: { type: "system" },
    data:
      action.type === "tag.add"
        ? { added: [{ tagId: tag.id, tagName: tag.name }], removed: [] }
        : { added: [], removed: [{ tagId: tag.id, tagName: tag.name }] },
  });

  return {
    actionId: action.id,
    type: action.type,
    status: "applied",
    detail: `${action.type === "tag.add" ? "Added" : "Removed"} tag "${tag.name}"`,
  };
}
