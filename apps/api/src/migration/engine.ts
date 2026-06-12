import type { Database } from "@omnipaper/database/client";
import type { PropertyValueColumns } from "@omnipaper/database/queries/custom-properties";
import {
  createPropertyDefinition,
  getOrgPropertyDefinitions,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import {
  createDocumentType,
  getOrgDocumentTypes,
} from "@omnipaper/database/queries/document-types";
import { updateDocument } from "@omnipaper/database/queries/documents";
import { createStoragePath, getOrgStoragePaths } from "@omnipaper/database/queries/storage-paths";
import { createTag, getOrgTags, setDocumentTags } from "@omnipaper/database/queries/tags";
import type { MigrationOptions } from "@omnipaper/database/schema";
import {
  type IntermediateRepresentation,
  type IRCustomValue,
  type IRDocument,
  resolveDocumentDate,
} from "@omnipaper/migration/ir";
import type { ZipSource } from "@omnipaper/migration/zip";
import type { StorageDriver } from "@omnipaper/storage/driver";
import { ingestDocument } from "../lib/ingest";

// The source-agnostic import engine: it consumes the IR an adapter produced and writes it into the
// org via the same ingest funnel browser uploads use. Knows nothing about Paperless.

const CORRESPONDENT_PROPERTY_NAME = "Correspondent";
const CORRESPONDENT_PROPERTY_KEY = "correspondent";
// Flush progress counters to the migration record every N documents instead of per-document, so a
// large library doesn't issue tens of thousands of tiny UPDATEs while still moving the progress bar.
const PROGRESS_FLUSH_EVERY = 25;
// Per-document ceiling: ingestDocument buffers the whole file in memory to hash + store it, and
// documents.size_bytes is a 32-bit integer (~2.1 GB). Cap below that so a pathological entry fails
// its own document (logged in the report) instead of OOMing the worker or overflowing the column.
const MAX_DOCUMENT_BYTES = 2_000_000_000;

export type MigrationProgress = { imported: number; duplicate: number; failed: number };

export type MigrationReport = MigrationProgress & {
  errors: { sourceId: string; fileRef: string; message: string }[];
};

export type RunMigrationInput = {
  db: Database;
  driver: StorageDriver;
  zip: ZipSource;
  ir: IntermediateRepresentation;
  organizationId: string;
  createdBy: string;
  options: MigrationOptions;
  /** Called with cumulative progress periodically (and once at the end) so the UI can poll it. */
  onProgress?: (progress: MigrationProgress) => Promise<void>;
};

// Maps from a source entity's id to the upserted omnipaper id, built once before ingesting documents.
type TaxonomyMaps = {
  organizationId: string;
  tagId: Map<string, string>;
  typeId: Map<string, string>;
  pathId: Map<string, string>;
  defId: Map<string, string>;
  // Per source-definition: source option id → omnipaper option id (for select properties).
  optionId: Map<string, Map<string, string>>;
  correspondentDefId: string | null;
};

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}_${n}`)) {
    n++;
  }
  return `${base}_${n}`;
}

function toValueColumns(
  value: IRCustomValue,
  optionMap: Map<string, string> | undefined,
): PropertyValueColumns | null {
  switch (value.kind) {
    case "text":
    case "url":
      return { valueText: value.value };
    case "number":
      return { valueNumber: value.value };
    case "date":
      return { valueDate: value.value };
    case "boolean":
      return { valueBool: value.value };
    case "select": {
      const selectOptionId = optionMap?.get(value.optionSourceId);
      return selectOptionId ? { selectOptionId } : null;
    }
  }
}

async function streamToUint8Array(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk as Buffer);
    total += buffer.byteLength;
    if (total > MAX_DOCUMENT_BYTES) {
      throw new Error(`Document exceeds the ${Math.round(MAX_DOCUMENT_BYTES / 1e9)} GB size limit`);
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

// Upsert all taxonomy by org-scoped natural key (tag/type name, storage path, property name), so a
// re-run reuses existing rows and same-name entities from different source owners merge into one.
async function upsertTaxonomy(
  db: Database,
  organizationId: string,
  ir: IntermediateRepresentation,
): Promise<TaxonomyMaps> {
  const tagId = new Map<string, string>();
  const existingTags = await getOrgTags(db, { organizationId });
  const tagByName = new Map(existingTags.map((t) => [t.name, t.id]));
  for (const tag of ir.tags) {
    let id = tagByName.get(tag.name);
    if (!id) {
      id = (await createTag(db, { organizationId, name: tag.name, color: tag.color })).id;
      tagByName.set(tag.name, id);
    }
    tagId.set(tag.sourceId, id);
  }

  const typeId = new Map<string, string>();
  const existingTypes = await getOrgDocumentTypes(db, { organizationId });
  const typeByName = new Map(existingTypes.map((t) => [t.name, t.id]));
  for (const type of ir.documentTypes) {
    let id = typeByName.get(type.name);
    if (!id) {
      id = (await createDocumentType(db, { organizationId, name: type.name })).id;
      typeByName.set(type.name, id);
    }
    typeId.set(type.sourceId, id);
  }

  const pathId = new Map<string, string>();
  const existingPaths = await getOrgStoragePaths(db, { organizationId });
  const pathByPath = new Map(existingPaths.map((p) => [p.path, p.id]));
  for (const path of ir.storagePaths) {
    let id = pathByPath.get(path.path);
    if (!id) {
      id = (await createStoragePath(db, { organizationId, path: path.path })).id;
      pathByPath.set(path.path, id);
    }
    pathId.set(path.sourceId, id);
  }

  const defId = new Map<string, string>();
  const optionId = new Map<string, Map<string, string>>();
  const existingDefs = await getOrgPropertyDefinitions(db, { organizationId });
  const defByName = new Map(existingDefs.map((d) => [d.definition.name, d]));
  const takenKeys = new Set(existingDefs.map((d) => d.definition.key));

  for (const def of ir.customPropertyDefs) {
    const existing = defByName.get(def.name);
    let id: string;
    let options: { id: string; label: string }[];
    if (existing) {
      id = existing.definition.id;
      options = existing.options;
    } else {
      const key = uniqueKey(slugify(def.name), takenKeys);
      takenKeys.add(key);
      const created = await createPropertyDefinition(db, {
        organizationId,
        key,
        name: def.name,
        type: def.type,
        options:
          def.type === "select"
            ? (def.selectOptions ?? []).map((o) => ({ label: o.label }))
            : undefined,
      });
      id = created.definition.id;
      options = created.options;
      defByName.set(def.name, {
        definition: created.definition,
        options: created.options,
        documentCount: 0,
      });
    }
    defId.set(def.sourceId, id);

    if (def.type === "select") {
      const map = new Map<string, string>();
      for (const sourceOption of def.selectOptions ?? []) {
        const match = options.find((o) => o.label === sourceOption.label);
        if (match) {
          map.set(sourceOption.sourceId, match.id);
        }
      }
      optionId.set(def.sourceId, map);
    }
  }

  // The `correspondent` property is auto-created only if any document actually has one.
  let correspondentDefId: string | null = null;
  if (ir.documents.some((d) => d.correspondent)) {
    const existing = defByName.get(CORRESPONDENT_PROPERTY_NAME);
    if (existing) {
      correspondentDefId = existing.definition.id;
    } else {
      const key = uniqueKey(CORRESPONDENT_PROPERTY_KEY, takenKeys);
      takenKeys.add(key);
      correspondentDefId = (
        await createPropertyDefinition(db, {
          organizationId,
          key,
          name: CORRESPONDENT_PROPERTY_NAME,
          type: "text",
        })
      ).definition.id;
    }
  }

  return { organizationId, tagId, typeId, pathId, defId, optionId, correspondentDefId };
}

// Attach a document's taxonomy/properties. Runs for created AND duplicate documents — file dedup
// makes the bytes idempotent, but the metadata must still (re-)apply, so a re-run after a crash
// between insert and link finishes the job. setDocumentTags / setDocumentPropertyValue are upserts.
async function linkDocument(
  db: Database,
  documentId: string,
  doc: IRDocument,
  maps: TaxonomyMaps,
): Promise<void> {
  const tagIds = doc.tagRefs
    .map((ref) => maps.tagId.get(ref))
    .filter((id): id is string => id !== undefined);
  if (tagIds.length > 0) {
    await setDocumentTags(db, { documentId, tagIds });
  }

  const documentTypeId = doc.typeRef ? (maps.typeId.get(doc.typeRef) ?? null) : null;
  const storagePathId = doc.storagePathRef ? (maps.pathId.get(doc.storagePathRef) ?? null) : null;
  if (documentTypeId !== null || storagePathId !== null) {
    await updateDocument(db, {
      organizationId: maps.organizationId,
      id: documentId,
      documentTypeId,
      storagePathId,
    });
  }

  for (const value of doc.customValues) {
    const definitionId = maps.defId.get(value.defSourceId);
    if (!definitionId) {
      continue;
    }
    const columns = toValueColumns(value, maps.optionId.get(value.defSourceId));
    if (columns) {
      await setDocumentPropertyValue(db, { documentId, definitionId, values: columns });
    }
  }

  if (doc.correspondent && maps.correspondentDefId) {
    await setDocumentPropertyValue(db, {
      documentId,
      definitionId: maps.correspondentDefId,
      values: { valueText: doc.correspondent },
    });
  }
}

export async function runMigration(input: RunMigrationInput): Promise<MigrationReport> {
  const { db, driver, zip, ir, organizationId, createdBy, options } = input;
  const timezone = options.timezone ?? "UTC";

  const maps = await upsertTaxonomy(db, organizationId, ir);

  const report: MigrationReport = { imported: 0, duplicate: 0, failed: 0, errors: [] };
  let sinceFlush = 0;

  const flush = async () => {
    sinceFlush = 0;
    await input.onProgress?.({
      imported: report.imported,
      duplicate: report.duplicate,
      failed: report.failed,
    });
  };

  for (const doc of ir.documents) {
    try {
      const bytes = await streamToUint8Array(await zip.openReadStream(doc.fileRef));

      const result = await ingestDocument({
        db,
        driver,
        organizationId,
        createdBy,
        bytes,
        filename: doc.originalFilename ?? basename(doc.fileRef),
        mimeType: doc.mimeType,
        title: doc.title,
        ocrText: options.importOcr ? (doc.ocrText ?? undefined) : undefined,
        documentDate: resolveDocumentDate(doc.documentDate, timezone) ?? undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      });

      // Per-document failures must not abort the run, so linking is inside the try: a bad link logs
      // the document as failed and the import continues.
      await linkDocument(db, result.document.id, doc, maps);

      if (result.status === "created") {
        report.imported++;
      } else {
        report.duplicate++;
      }
    } catch (err) {
      report.failed++;
      report.errors.push({
        sourceId: doc.sourceId,
        fileRef: doc.fileRef,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }

    if (++sinceFlush >= PROGRESS_FLUSH_EVERY) {
      await flush();
    }
  }

  await flush();
  return report;
}
