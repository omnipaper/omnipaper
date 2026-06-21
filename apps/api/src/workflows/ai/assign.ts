import { classifyDocument } from "@omnipaper/ai/classify";
import { getAiProvider, resolveModel } from "@omnipaper/ai/resolve";
import type { ActionResult, WorkflowAction } from "@omnipaper/shared/workflows";
import { getAiSettings } from "@omnipaper/settings/ai-settings";
import { getProviderKeys } from "@omnipaper/settings/provider-settings";
import type { WorkflowRunContext } from "../context";
import { applyAiResults } from "./apply";
import { loadAiCandidates } from "./candidates";
import { buildClassifyPrompts } from "./prompt";
import { buildResponseSchema } from "./schema";

type AiAssignAction = Extract<WorkflowAction, { type: "ai.assignMetadata" }>;

// One LLM call for the whole action: load candidates → build the dynamic schema + prompt → classify
// → fork auto/suggest per field. A transient provider error propagates as a retryable AiError so the
// runner lets the queue retry; deterministic problems (no text, no key) return a clean skip.
export async function runAiAssign(
  action: AiAssignAction,
  ctx: WorkflowRunContext,
): Promise<ActionResult> {
  const { db, document } = ctx;
  const { fields } = action.config;

  if (!document.ocrText || document.ocrText.trim() === "") {
    return skip(action, "Document has no extracted text");
  }

  const settings = await getAiSettings();
  const keys = await getProviderKeys();
  const apiKey = keys[settings.provider];

  if (!apiKey) {
    return skip(action, `AI is not configured: missing ${settings.provider} API key`);
  }

  const candidates = await loadAiCandidates(db, {
    organizationId: document.organizationId,
    fields,
  });
  const schema = buildResponseSchema(fields, candidates);
  const { system, prompt } = buildClassifyPrompts({ fields, candidates, ocrText: document.ocrText });

  const provider = getAiProvider(settings.provider);
  const model = resolveModel(provider, action.config.model ?? settings.model);

  const response = await classifyDocument({
    provider: settings.provider,
    model,
    apiKey,
    system,
    prompt,
    schema,
  });

  const detail = await applyAiResults(ctx, { fields, candidates, response, model });

  return { actionId: action.id, type: action.type, status: "applied", detail };
}

function skip(action: AiAssignAction, detail: string): ActionResult {
  return { actionId: action.id, type: action.type, status: "skipped", detail };
}
