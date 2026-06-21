import { recordEvent } from "@omnipaper/database/activity";
import { upsertSuggestion } from "@omnipaper/database/queries/ai-suggestions";
import {
  getDocumentPropertyValues,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import { updateDocument } from "@omnipaper/database/queries/documents";
import { addDocumentTags } from "@omnipaper/database/queries/tags";
import type {
  AiAssignFields,
  CustomPropertySuggestionValue,
  DocumentDateSuggestionValue,
  DocumentTypeSuggestionValue,
  StoragePathSuggestionValue,
  TagsSuggestionValue,
} from "@omnipaper/shared/workflows";
import { customPropertyRegistry, type ValueColumns } from "../../custom-properties/registry";
import type { WorkflowRunContext } from "../context";
import type { AiCandidates, CandidateCustomField } from "./candidates";
import { type AiClassifyResponse, NO_MATCH } from "./schema";

// The auto/suggest fork over ONE parsed LLM response. There is never a second call to the model —
// we parse once and branch per field. Precedence is user-set > AI-auto > empty: `auto` never
// overwrites a field the user already committed; `suggest` stages a chip the user confirms.

type ApplyParams = {
  fields: AiAssignFields;
  candidates: AiCandidates;
  response: AiClassifyResponse;
  model: string;
};

export async function applyAiResults(
  ctx: WorkflowRunContext,
  params: ApplyParams,
): Promise<string> {
  const { db, document, workflowId, runId } = ctx;
  const organizationId = document.organizationId;
  const { fields, candidates, response, model } = params;

  let autoCount = 0;
  let suggestCount = 0;

  const suggest = (
    field: Parameters<typeof upsertSuggestion>[1]["field"],
    suggestedValue: unknown,
    confidence: number,
    definitionId?: string,
  ) =>
    upsertSuggestion(db, {
      organizationId,
      documentId: document.id,
      field,
      definitionId,
      suggestedValue,
      confidence,
      model,
      workflowId,
      sourceRunId: runId,
    });

  // --- single-valued metadata: batched into one update + one activity event ----------------------
  const autoPatch: { documentTypeId?: string; storagePathId?: string; documentDate?: string } = {};
  const autoFields: string[] = [];

  if (fields.documentType && response.documentType) {
    const { id, confidence } = response.documentType;
    if (id !== NO_MATCH && candidates.documentTypes.some((t) => t.id === id)) {
      if (fields.documentType.mode === "auto") {
        if (!document.documentTypeId) {
          autoPatch.documentTypeId = id;
          autoFields.push("documentTypeId");
          autoCount++;
        }
      } else {
        await suggest("documentType", { id } satisfies DocumentTypeSuggestionValue, confidence);
        suggestCount++;
      }
    }
  }

  if (fields.storagePath && response.storagePath) {
    const { id, confidence } = response.storagePath;
    if (id !== NO_MATCH && candidates.storagePaths.some((p) => p.id === id)) {
      if (fields.storagePath.mode === "auto") {
        if (!document.storagePathId) {
          autoPatch.storagePathId = id;
          autoFields.push("storagePathId");
          autoCount++;
        }
      } else {
        await suggest("storagePath", { id } satisfies StoragePathSuggestionValue, confidence);
        suggestCount++;
      }
    }
  }

  if (fields.documentDate && response.documentDate) {
    const { value, quote, confidence } = response.documentDate;
    // Reject a value the model didn't quote verbatim from the text — kills hallucinated dates.
    const grounded = value !== null && quote !== null && (document.ocrText ?? "").includes(quote);
    if (grounded) {
      if (fields.documentDate.mode === "auto") {
        if (!document.documentDate) {
          autoPatch.documentDate = value;
          autoFields.push("documentDate");
          autoCount++;
        }
      } else {
        await suggest("documentDate", { value } satisfies DocumentDateSuggestionValue, confidence);
        suggestCount++;
      }
    }
  }

  if (autoFields.length > 0) {
    await updateDocument(db, { organizationId, id: document.id, ...autoPatch });
    await recordEvent(db, {
      organizationId,
      resource: { type: "document", id: document.id, label: document.title },
      event: "document.metadata_updated",
      actor: { type: "system" },
      data: { updatedFields: autoFields },
    });
  }

  // --- tags ---------------------------------------------------------------------------------------
  if (fields.tags && response.tags) {
    const candidateTagIds = new Set(candidates.tags.map((t) => t.id));
    const existing = [...new Set(response.tags.existingIds.filter((id) => candidateTagIds.has(id)))];
    // New vocabulary needs a human, so newNames only survive in suggest mode with allowNew.
    const allowNew = fields.tags.allowNew && fields.tags.mode === "suggest";
    const newNames = allowNew
      ? [...new Set(response.tags.newNames.map((name) => name.trim()).filter(Boolean))]
      : [];

    const cappedExisting = existing.slice(0, fields.tags.max);
    const cappedNew = newNames.slice(0, Math.max(0, fields.tags.max - cappedExisting.length));

    if (fields.tags.mode === "auto") {
      if (cappedExisting.length > 0) {
        await addDocumentTags(db, { documentId: document.id, tagIds: cappedExisting });
        const added = candidates.tags.filter((t) => cappedExisting.includes(t.id));
        await recordEvent(db, {
          organizationId,
          resource: { type: "document", id: document.id, label: document.title },
          event: "document.tags_updated",
          actor: { type: "system" },
          data: { added: added.map((t) => ({ tagId: t.id, tagName: t.name })), removed: [] },
        });
        autoCount++;
      }
    } else if (cappedExisting.length > 0 || cappedNew.length > 0) {
      await suggest(
        "tags",
        { existingIds: cappedExisting, newNames: cappedNew } satisfies TagsSuggestionValue,
        response.tags.confidence,
      );
      suggestCount++;
    }
  }

  // --- custom fields ------------------------------------------------------------------------------
  if (fields.customFields && response.customFields) {
    const committed =
      fields.customFields.mode === "auto"
        ? new Set(
            (await getDocumentPropertyValues(db, { documentId: document.id })).map(
              (v) => v.definitionId,
            ),
          )
        : new Set<string>();
    const byId = new Map(candidates.customFields.map((f) => [f.id, f]));
    const updatedDefinitions: string[] = [];

    for (const result of response.customFields) {
      if (result.definitionId === NO_MATCH) {
        continue;
      }
      const field = byId.get(result.definitionId);
      if (!field) {
        continue;
      }
      const columns = coerceCustomValue(field, result.value, result.selectOptionId);
      if (!columns) {
        continue;
      }

      if (fields.customFields.mode === "auto") {
        if (committed.has(field.id)) {
          continue;
        }
        await setDocumentPropertyValue(db, {
          documentId: document.id,
          definitionId: field.id,
          values: columns,
        });
        updatedDefinitions.push(field.id);
        autoCount++;
      } else {
        await suggest(
          "customProperty",
          columns satisfies CustomPropertySuggestionValue,
          result.confidence,
          field.id,
        );
        suggestCount++;
      }
    }

    if (updatedDefinitions.length > 0) {
      await recordEvent(db, {
        organizationId,
        resource: { type: "document", id: document.id, label: document.title },
        event: "document.property_updated",
        actor: { type: "system" },
        data: { updatedDefinitions },
      });
    }
  }

  return `auto: ${autoCount}, suggested: ${suggestCount}`;
}

// Coerce the model's stringified value into the definition's EAV columns, validating with the same
// registry the API uses for human input. Returns null (→ skip) on anything that doesn't fit the type.
function coerceCustomValue(
  field: CandidateCustomField,
  value: string | null,
  selectOptionId: string | null,
): ValueColumns | null {
  const definition = customPropertyRegistry[field.type];

  if (field.type === "select") {
    if (!selectOptionId || !field.options.some((o) => o.id === selectOptionId)) {
      return null;
    }
    return definition.toDb(selectOptionId);
  }

  if (value === null || value.trim() === "") {
    return null;
  }

  let raw: unknown = value;
  if (field.type === "number") {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }
    raw = parsed;
  } else if (field.type === "boolean") {
    if (value !== "true" && value !== "false") {
      return null;
    }
    raw = value === "true";
  }

  const result = definition.inputSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return definition.toDb(result.data);
}
