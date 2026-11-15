import type { AiToolContext } from "./context";
import { getDocumentTool } from "./get-document";
import { getDocumentHistoryTool } from "./get-document-history/get-document-history";

// Every AI feature (assistant, jobs, dev script) reaches the app through these tools and nothing
// else. Static instances: organizationId is injected per call via aiToolsContext, not baked in here.
export const aiTools = {
  get_document: getDocumentTool,
  get_document_history: getDocumentHistoryTool,
};

// toolsContext is keyed by tool name; fan the shared context out so a missing key fails to compile.
export function aiToolsContext(ctx: AiToolContext) {
  return {
    get_document: ctx,
    get_document_history: ctx,
  };
}
