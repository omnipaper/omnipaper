export type SourceRef = string;

export type IRTag = {
  sourceId: SourceRef;
  name: string;
  color: string;
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
  path: string;
  owner: string | null;
};

export type IRCustomPropertyType = "text" | "url" | "number" | "date" | "boolean" | "select";

export type IRSelectOption = { sourceId: SourceRef; label: string };

export type IRCustomPropertyDef = {
  sourceId: SourceRef;
  name: string;
  type: IRCustomPropertyType;
  selectOptions?: IRSelectOption[];
};

export type IRCustomValue =
  | { defSourceId: SourceRef; kind: "text"; value: string }
  | { defSourceId: SourceRef; kind: "url"; value: string }
  | { defSourceId: SourceRef; kind: "number"; value: number }
  | { defSourceId: SourceRef; kind: "date"; value: string }
  | { defSourceId: SourceRef; kind: "boolean"; value: boolean }
  | { defSourceId: SourceRef; kind: "select"; optionSourceId: SourceRef };

export type IRDate = { kind: "date"; value: string } | { kind: "instant"; value: string };

export type IRDocument = {
  sourceId: SourceRef;
  title: string;
  fileRef: string;
  mimeType: string;
  originalFilename: string | null;
  documentDate: IRDate | null;
  createdAt: string | null;
  ocrText: string | null;
  correspondent: string | null;
  typeRef: SourceRef | null;
  storagePathRef: SourceRef | null;
  tagRefs: SourceRef[];
  customValues: IRCustomValue[];
  owner: string | null;
};

export type IntermediateRepresentation = {
  documents: IRDocument[];
  documentTypes: IRDocumentType[];
  storagePaths: IRStoragePath[];
  tags: IRTag[];
  customPropertyDefs: IRCustomPropertyDef[];
};

export type DroppedLedger = {
  notes: number;
  savedViews: number;
  workflows: number;
  droppedCustomFields: number;
  perDocumentPermissions: number;
  archiveSerialNumbers: number;
  trashedDocuments: number;
  mergedTaxonomy: { kind: string; name: string; count: number }[];
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
  missingFiles: string[];
  mimeBreakdown: Record<string, number>;
  needsTimezone: boolean;
};

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
    return instant.toISOString().slice(0, 10);
  }
}
