import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { type AiSuggestion, aiSuggestions } from "../schema";

// Data access for AI suggestions (the `suggest`-mode output). Upsert overwrites a field's pending
// suggestion on re-run; status transitions (accept/dismiss/supersede) move a row out of `pending`.

export type SuggestionField = AiSuggestion["field"];

export type UpsertSuggestionInput = {
  organizationId: string;
  documentId: string;
  field: SuggestionField;
  definitionId?: string | null;
  suggestedValue: unknown;
  confidence?: number | null;
  model?: string | null;
  workflowId?: string | null;
  sourceRunId?: string | null;
};

// One row per (document, field, definition). A re-run replaces the value and resets the row to
// pending, refreshing createdAt so it reads as a fresh suggestion. Targets the unique constraint
// ai_suggestions_doc_field_def_idx (NULLS NOT DISTINCT covers the NULL definitionId of built-ins).
export async function upsertSuggestion(db: Database, input: UpsertSuggestionInput) {
  const [suggestion] = await db
    .insert(aiSuggestions)
    .values({
      organizationId: input.organizationId,
      documentId: input.documentId,
      field: input.field,
      definitionId: input.definitionId ?? null,
      suggestedValue: input.suggestedValue,
      confidence: input.confidence ?? null,
      model: input.model ?? null,
      workflowId: input.workflowId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [aiSuggestions.documentId, aiSuggestions.field, aiSuggestions.definitionId],
      set: {
        suggestedValue: input.suggestedValue,
        confidence: input.confidence ?? null,
        model: input.model ?? null,
        workflowId: input.workflowId ?? null,
        sourceRunId: input.sourceRunId ?? null,
        status: "pending",
        createdAt: new Date(),
      },
    })
    .returning();

  return suggestion;
}

export async function getDocumentSuggestions(
  db: Database,
  params: { documentId: string; status?: AiSuggestion["status"] },
) {
  return db
    .select()
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.documentId, params.documentId),
        eq(aiSuggestions.status, params.status ?? "pending"),
      ),
    )
    .orderBy(desc(aiSuggestions.createdAt));
}

// Single suggestion scoped to its org — the safe default for accept/dismiss so one tenant can't act
// on another's suggestion by id.
export async function getOrgSuggestion(
  db: Database,
  params: { organizationId: string; id: string },
) {
  const [suggestion] = await db
    .select()
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.id, params.id),
        eq(aiSuggestions.organizationId, params.organizationId),
      ),
    )
    .limit(1);

  return suggestion;
}

export async function setSuggestionStatus(
  db: Database,
  params: { id: string; status: AiSuggestion["status"] },
) {
  await db
    .update(aiSuggestions)
    .set({ status: params.status })
    .where(eq(aiSuggestions.id, params.id));
}

// A manual edit supersedes any pending suggestion for the same field(s) — the user's choice wins, so
// the chip disappears instead of contradicting what they just set. Used for built-in fields + tags.
export async function supersedePendingSuggestions(
  db: Database,
  params: { documentId: string; fields: SuggestionField[] },
) {
  if (params.fields.length === 0) {
    return;
  }

  await db
    .update(aiSuggestions)
    .set({ status: "superseded" })
    .where(
      and(
        eq(aiSuggestions.documentId, params.documentId),
        eq(aiSuggestions.status, "pending"),
        inArray(aiSuggestions.field, params.fields),
      ),
    );
}

// Custom properties supersede per definition (each is its own suggestion row).
export async function supersedePendingCustomPropertySuggestion(
  db: Database,
  params: { documentId: string; definitionId: string },
) {
  await db
    .update(aiSuggestions)
    .set({ status: "superseded" })
    .where(
      and(
        eq(aiSuggestions.documentId, params.documentId),
        eq(aiSuggestions.status, "pending"),
        eq(aiSuggestions.field, "customProperty"),
        eq(aiSuggestions.definitionId, params.definitionId),
      ),
    );
}
