// AI suggestion shapes, shared by the API (writes + accept) and the web (renders the chips). The
// `field` discriminates which payload `suggestedValue` carries. A custom-property suggestion also
// carries the `definitionId` it targets (the only field that fans out per definition).

export const AI_SUGGESTION_FIELDS = [
  "documentType",
  "storagePath",
  "tags",
  "documentDate",
  "customProperty",
] as const;

export type AiSuggestionField = (typeof AI_SUGGESTION_FIELDS)[number];

// --- per-field `suggestedValue` payloads (stored as jsonb) --------------------------------------

// References an existing taxonomy row; resolved to a label at read time, skipped if since deleted.
export type DocumentTypeSuggestionValue = { id: string };
export type StoragePathSuggestionValue = { id: string };

// ISO YYYY-MM-DD, already verified to be quoted from the document text (not a hallucinated date).
export type DocumentDateSuggestionValue = { value: string };

// Existing tag ids to attach, plus brand-new names to create on accept (only when allowNew).
export type TagsSuggestionValue = { existingIds: string[]; newNames: string[] };

// Pre-coerced to the definition's EAV columns at suggestion time (exactly one populated, like the
// document_custom_property_values shape) so accept is a plain setDocumentPropertyValue, and the chip
// label can be rendered by the same registry.fromDb used for stored values.
export type CustomPropertySuggestionValue = {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBool: boolean | null;
  selectOptionId: string | null;
};

export type AiSuggestionValueByField = {
  documentType: DocumentTypeSuggestionValue;
  storagePath: StoragePathSuggestionValue;
  documentDate: DocumentDateSuggestionValue;
  tags: TagsSuggestionValue;
  customProperty: CustomPropertySuggestionValue;
};
