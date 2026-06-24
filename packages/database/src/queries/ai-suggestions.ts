import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { aiSuggestions, type NewAiSuggestion } from "../schema";

export type UpsertAiSuggestionInput = {
  documentId: string;
  field: NewAiSuggestion["field"];
  customPropertyDefinitionId?: string | null;
  suggestedValue: NewAiSuggestion["suggestedValue"];
};

// One open suggestion per (document, field, customPropertyDefinitionId): a re-run replaces the
// previous one and reopens it as pending. Backed by ai_suggestions_doc_field_def_idx (NULLS NOT
// DISTINCT), so the NULL definition id of non-custom fields still collapses to one row.
export async function upsertAiSuggestion(db: Database, input: UpsertAiSuggestionInput) {
  const customPropertyDefinitionId = input.customPropertyDefinitionId ?? null;
  const values = {
    documentId: input.documentId,
    field: input.field,
    customPropertyDefinitionId,
    suggestedValue: input.suggestedValue,
    status: "pending" as const,
  };
  const set = {
    suggestedValue: input.suggestedValue,
    status: "pending" as const,
    createdAt: new Date(),
  };

  const [suggestion] =
    customPropertyDefinitionId === null
      ? await db
          .insert(aiSuggestions)
          .values(values)
          .onConflictDoUpdate({
            target: [aiSuggestions.documentId, aiSuggestions.field],
            targetWhere: isNull(aiSuggestions.customPropertyDefinitionId),
            set,
          })
          .returning()
      : await db
          .insert(aiSuggestions)
          .values(values)
          .onConflictDoUpdate({
            target: [
              aiSuggestions.documentId,
              aiSuggestions.field,
              aiSuggestions.customPropertyDefinitionId,
            ],
            targetWhere: isNotNull(aiSuggestions.customPropertyDefinitionId),
            set,
          })
          .returning();

  return suggestion;
}

export async function getPendingSuggestions(db: Database, params: { documentId: string }) {
  return db
    .select()
    .from(aiSuggestions)
    .where(
      and(eq(aiSuggestions.documentId, params.documentId), eq(aiSuggestions.status, "pending")),
    );
}

export type SetSuggestionStatusInput = {
  documentId: string;
  id: string;
  status: "accepted" | "dismissed";
};

export async function setSuggestionStatus(db: Database, input: SetSuggestionStatusInput) {
  const [suggestion] = await db
    .update(aiSuggestions)
    .set({ status: input.status })
    .where(and(eq(aiSuggestions.id, input.id), eq(aiSuggestions.documentId, input.documentId)))
    .returning();

  return suggestion;
}

export type DismissSuggestionsForFieldInput = {
  documentId: string;
  field: NewAiSuggestion["field"];
  customPropertyDefinitionId?: string | null;
};

// A manual edit to a field invalidates any pending suggestion for it, so the chip stops showing.
export async function dismissSuggestionsForField(
  db: Database,
  params: DismissSuggestionsForFieldInput,
) {
  const defId = params.customPropertyDefinitionId;
  await db
    .update(aiSuggestions)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(aiSuggestions.documentId, params.documentId),
        eq(aiSuggestions.field, params.field),
        defId === undefined
          ? undefined
          : defId === null
            ? isNull(aiSuggestions.customPropertyDefinitionId)
            : eq(aiSuggestions.customPropertyDefinitionId, defId),
        eq(aiSuggestions.status, "pending"),
      ),
    );
}
