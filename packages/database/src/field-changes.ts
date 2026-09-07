import type { FieldChangeValue, FieldSource } from "@omnipaper/shared/field-changes";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { documentFieldChanges, type NewDocumentFieldChange } from "./schema";

type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const COALESCE_WINDOW_MS = 10 * 60 * 1000;

export type FieldChangeInput = {
  field: NewDocumentFieldChange["field"];
  customPropertyDefinitionId?: string | null;
  oldValue?: FieldChangeValue | null;
  newValue?: FieldChangeValue | null;
};

export type RecordFieldChangesInput = {
  documentId: string;
  source: FieldSource;
  createdBy?: string | null;
  changes: FieldChangeInput[];
};

// Identity of a value for no-op and coalescing checks: renames don't change identity.
function valueKey(value: FieldChangeValue | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return "id" in value ? `id:${value.id}` : `value:${value.value}`;
}

// Human edits of the same (document, field, definition) within the window collapse into one row
// per editing session: old_value keeps the session's starting point, new_value follows the latest
// edit. Editing back to the starting value deletes the row (the session was a no-op). AI writes
// are single-shot and tag rows are itemized add/remove, so neither coalesces.
async function coalesce(
  tx: DbOrTx,
  input: RecordFieldChangesInput,
  change: FieldChangeInput,
): Promise<boolean> {
  const definitionId = change.customPropertyDefinitionId ?? null;
  const [existing] = await tx
    .select()
    .from(documentFieldChanges)
    .where(
      and(
        eq(documentFieldChanges.documentId, input.documentId),
        eq(documentFieldChanges.field, change.field),
        definitionId === null
          ? isNull(documentFieldChanges.customPropertyDefinitionId)
          : eq(documentFieldChanges.customPropertyDefinitionId, definitionId),
        eq(documentFieldChanges.source, "human"),
        input.createdBy
          ? eq(documentFieldChanges.createdBy, input.createdBy)
          : isNull(documentFieldChanges.createdBy),
        gte(documentFieldChanges.createdAt, new Date(Date.now() - COALESCE_WINDOW_MS)),
      ),
    )
    .orderBy(desc(documentFieldChanges.createdAt))
    .limit(1);

  if (!existing) {
    return false;
  }

  if (valueKey(existing.oldValue) === valueKey(change.newValue)) {
    await tx.delete(documentFieldChanges).where(eq(documentFieldChanges.id, existing.id));
  } else {
    await tx
      .update(documentFieldChanges)
      .set({ newValue: change.newValue ?? null })
      .where(eq(documentFieldChanges.id, existing.id));
  }
  return true;
}

export async function recordFieldChanges(tx: DbOrTx, input: RecordFieldChangesInput) {
  const effective = input.changes.filter(
    (change) => valueKey(change.oldValue) !== valueKey(change.newValue),
  );

  const rows: NewDocumentFieldChange[] = [];
  for (const change of effective) {
    const merged =
      input.source === "human" && change.field !== "tags" && (await coalesce(tx, input, change));
    if (!merged) {
      rows.push({
        documentId: input.documentId,
        field: change.field,
        customPropertyDefinitionId: change.customPropertyDefinitionId ?? null,
        oldValue: change.oldValue ?? null,
        newValue: change.newValue ?? null,
        source: input.source,
        createdBy: input.createdBy ?? null,
      });
    }
  }

  if (rows.length > 0) {
    await tx.insert(documentFieldChanges).values(rows);
  }
}

// Provenance of a document's current field values, derived from the journal: the latest row per
// (field, definition) tells who set what is there now. No row = value predates tracking, callers
// treat that as human-set (safe direction).
export async function getLatestFieldSources(db: Database, params: { documentId: string }) {
  return db
    .selectDistinctOn(
      [documentFieldChanges.field, documentFieldChanges.customPropertyDefinitionId],
      {
        field: documentFieldChanges.field,
        customPropertyDefinitionId: documentFieldChanges.customPropertyDefinitionId,
        source: documentFieldChanges.source,
      },
    )
    .from(documentFieldChanges)
    .where(eq(documentFieldChanges.documentId, params.documentId))
    .orderBy(
      documentFieldChanges.field,
      documentFieldChanges.customPropertyDefinitionId,
      desc(documentFieldChanges.createdAt),
    );
}
