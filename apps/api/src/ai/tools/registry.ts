import type { AiToolContext } from "./context";
import { getDocumentTool } from "./get-document";
import { getDocumentHistoryTool } from "./get-document-history/get-document-history";

// Every AI feature (assistant, jobs, dev script) reaches the app through these tools and nothing
// else. Static instances: organizationId is injected per call via aiToolsContext, not baked in here.
export const aiTools = {
  get_document: getDocumentTool,
  get_document_history: getDocumentHistoryTool,
};

// generateText's toolsContext is keyed by tool name. Every tool takes the same context, so fan the
// caller's context out to each one; a missing key here is a compile error at the call site.
export function aiToolsContext(ctx: AiToolContext) {
  return {
    get_document: ctx,
    get_document_history: ctx,
  };
}
