import type { aiSuggestionFieldEnum } from "@omnipaper/database/schema";
import type { FieldChangeValue, FieldSource } from "@omnipaper/shared/field-changes";
import type { AiSuggestionValue } from "@omnipaper/shared/workflows/ai-assign";

type SuggestionField = (typeof aiSuggestionFieldEnum.enumValues)[number];

export type EntityRef = { id: string; name: string };

export type HistoryEntry =
  | {
      kind: "change";
      at: string;
      field: SuggestionField;
      definition?: EntityRef;
      old: FieldChangeValue | null;
      new: FieldChangeValue | null;
      source: FieldSource;
      by?: string;
    }
  | {
      kind: "suggestion";
      at: string;
      field: SuggestionField;
      definition?: EntityRef;
      value: FieldChangeValue;
      status: "pending" | "dismissed";
      resolvedBy?: string;
      resolvedAt?: string;
    };

export type HistoryLookups = {
  documentTypes: Map<string, string>;
  storagePaths: Map<string, string>;
  tags: Map<string, string>;
  definitions: Map<string, { name: string; options: Map<string, string> }>;
};

const DELETED = "(deleted)";

export function definitionRef(
  definitionId: string | null,
  lookups: HistoryLookups,
): EntityRef | undefined {
  if (!definitionId) {
    return undefined;
  }
  return { id: definitionId, name: lookups.definitions.get(definitionId)?.name ?? DELETED };
}

// Suggestions store references, not snapshots (pre-journal design), so names are resolved here.
// A tag-set suggestion fans out into one entry per tag to match the journal's granularity.
export function toSuggestionEntries(
  row: {
    field: SuggestionField;
    customPropertyDefinitionId: string | null;
    suggestedValue: AiSuggestionValue;
    status: "pending" | "accepted" | "dismissed";
    createdAt: Date;
    resolvedAt: Date | null;
    resolvedByName: string | null;
  },
  lookups: HistoryLookups,
): HistoryEntry[] {
  if (row.status === "accepted") {
    // An accepted suggestion materializes as a human "change" row; listing both would duplicate it.
    return [];
  }

  const base = {
    kind: "suggestion" as const,
    at: row.createdAt.toISOString(),
    field: row.field,
    definition: definitionRef(row.customPropertyDefinitionId, lookups),
    status: row.status,
    ...(row.resolvedByName ? { resolvedBy: row.resolvedByName } : {}),
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
  };

  const value = row.suggestedValue;

  if ("existingIds" in value) {
    return [
      ...value.existingIds.map((id) => ({
        ...base,
        value: { id, name: lookups.tags.get(id) ?? DELETED },
      })),
      ...value.newNames.map((name) => ({ ...base, value: { value: name } })),
    ];
  }
  if ("selectOptionId" in value) {
    const definition = row.customPropertyDefinitionId
      ? lookups.definitions.get(row.customPropertyDefinitionId)
      : undefined;
    const label = definition?.options.get(value.selectOptionId) ?? DELETED;
    return [{ ...base, value: { id: value.selectOptionId, name: label } }];
  }
  if ("newOptionLabel" in value) {
    return [{ ...base, value: { value: value.newOptionLabel } }];
  }
  if ("id" in value) {
    const names = row.field === "storagePath" ? lookups.storagePaths : lookups.documentTypes;
    return [{ ...base, value: { id: value.id, name: names.get(value.id) ?? DELETED } }];
  }
  return [{ ...base, value: { value: value.value } }];
}
