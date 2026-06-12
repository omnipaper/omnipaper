// Source-agnostic intermediate representation. Every adapter (Paperless first) parses its export
// into this shape; the import engine consumes only this and knows nothing about any source system.

/** The source system's primary key, stringified — used to map source entities to omnipaper ids. */
export type SourceRef = string;

export type IRTag = {
  sourceId: SourceRef;
  name: string;
  /** Hex color (e.g. "#a1b2c3"). */
  color: string;
  /** Owner username in the source, or null for an instance-wide entity. Used only for the merge ledger. */
  owner: string | null;
};

export type IRDocumentType = {
  sourceId: SourceRef;
  name: string;
  owner: string | null;
};

export type IRStoragePath = {
  sourceId: SourceRef;
  name: string;
  /** The literal folder path (a template's best-effort literal form). */
  path: string;
  owner: string | null;
};

export type IRCustomPropertyType = "text" | "url" | "number" | "date" | "boolean" | "select";

export type IRSelectOption = { sourceId: SourceRef; label: string };

export type IRCustomPropertyDef = {
  sourceId: SourceRef;
  name: string;
  type: IRCustomPropertyType;
  /** Present only for `select`. */
  selectOptions?: IRSelectOption[];
};

/** A custom-property value on a document, discriminated by the property's type. */
export type IRCustomValue =
  | { defSourceId: SourceRef; kind: "text"; value: string }
  | { defSourceId: SourceRef; kind: "url"; value: string }
  | { defSourceId: SourceRef; kind: "number"; value: number }
  | { defSourceId: SourceRef; kind: "date"; value: string }
  | { defSourceId: SourceRef; kind: "boolean"; value: boolean }
  | { defSourceId: SourceRef; kind: "select"; optionSourceId: SourceRef };

/**
 * A document's date as it came out of the source, normalized into one of two shapes so the engine
 * can resolve it without knowing the source's quirks:
 *  - `date`: already a calendar date (no timezone needed).
 *  - `instant`: a UTC instant; the engine converts it to a calendar date in the user-chosen timezone.
 * (Paperless ≤2.15.3 serializes `created` as a tz-aware datetime; ≥2.16.0 as a bare date.)
 */
export type IRDate = { kind: "date"; value: string } | { kind: "instant"; value: string };

export type IRDocument = {
  sourceId: SourceRef;
  title: string;
  /** Entry name inside the archive — what `openDocument` reads to get the original bytes. */
  fileRef: string;
  mimeType: string;
  originalFilename: string | null;
  documentDate: IRDate | null;
  /** The source's ingestion timestamp (e.g. Paperless `added`) as an ISO string, or null. */
  createdAt: string | null;
  /** Pre-extracted text (Paperless `content`) — a carry-over candidate, subject to the import option. */
  ocrText: string | null;
  /** Resolved correspondent name → stored as a `correspondent` custom property by the engine. */
  correspondent: string | null;
  typeRef: SourceRef | null;
  storagePathRef: SourceRef | null;
  tagRefs: SourceRef[];
  customValues: IRCustomValue[];
  /** Owner username in the source, or null. Used for the visibility warning / owner breakdown. */
  owner: string | null;
};

export type IntermediateRepresentation = {
  documents: IRDocument[];
  documentTypes: IRDocumentType[];
  storagePaths: IRStoragePath[];
  tags: IRTag[];
  customPropertyDefs: IRCustomPropertyDef[];
};

/** Everything deliberately NOT migrated, counted for the user-facing report. */
export type DroppedLedger = {
  notes: number;
  savedViews: number;
  workflows: number;
  /** Custom fields dropped wholesale (monetary, document-link, or unknown types). */
  droppedCustomFields: number;
  perDocumentPermissions: number;
  archiveSerialNumbers: number;
  /** Trashed (soft-deleted) documents skipped — only present in v3.0+ exports. */
  trashedDocuments: number;
  /** Groups of same-name taxonomy entities (across owners) that will merge into one on import. */
  mergedTaxonomy: { kind: string; name: string; count: number }[];
  /** Manifest record models we don't handle, by model name. */
  unknownModels: Record<string, number>;
};

export type OwnerBreakdown = { owner: string | null; documents: number };

export type AnalyzeResult = {
  counts: {
    documents: number;
    tags: number;
    documentTypes: number;
    storagePaths: number;
    customPropertyDefs: number;
  };
  ledger: DroppedLedger;
  ownerBreakdown: OwnerBreakdown[];
  /** Files referenced by the manifest but absent from the archive. */
  missingFiles: string[];
  /** Document count per MIME type — lets the preview flag types the active OCR can't read. */
  mimeBreakdown: Record<string, number>;
  /** True if any document's date is an `instant` — the preview should ask for a source timezone. */
  needsTimezone: boolean;
};

/**
 * Resolve a normalized IR date to a calendar date string (YYYY-MM-DD) in the given IANA timezone.
 * A `date` is returned verbatim (already local). An `instant` is converted to its calendar date in
 * `timezone` — this reproduces how the source computed the user-entered date and avoids the ±1-day
 * shift that taking the UTC date part would cause. Falls back to the UTC date on an invalid timezone.
 */
export function resolveDocumentDate(date: IRDate | null, timezone: string): string | null {
  if (!date) {
    return null;
  }
  if (date.kind === "date") {
    return date.value;
  }

  const instant = new Date(date.value);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    // Invalid timezone — fall back to the UTC calendar date rather than throwing mid-import.
    return instant.toISOString().slice(0, 10);
  }
}
