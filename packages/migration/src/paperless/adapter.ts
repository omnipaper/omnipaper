import type { SourceAdapter } from "../adapters";
import type {
  AnalyzeResult,
  DroppedLedger,
  IntermediateRepresentation,
  IRCustomPropertyDef,
  IRCustomPropertyType,
  IRCustomValue,
  IRDocument,
  IRDocumentType,
  IRStoragePath,
  IRTag,
} from "../ir";
import { type ManifestRecord, streamManifestRecords } from "../manifest";
import type { ZipSource } from "../zip";
import {
  asRef,
  asRefArray,
  asString,
  extractCustomValue,
  mapCustomFieldType,
  parseCreatedDate,
  parseSelectOptions,
} from "./records";

const SOURCE = "paperless";
const DEFAULT_TAG_COLOR = "#94a3b8";
const MANIFEST_BASENAME = "manifest.json";
const EXPORTER_FILE_NAME_KEY = "__exported_file_name__";

const MODEL = {
  correspondent: "documents.correspondent",
  documentType: "documents.documenttype",
  storagePath: "documents.storagepath",
  tag: "documents.tag",
  customField: "documents.customfield",
  customFieldInstance: "documents.customfieldinstance",
  document: "documents.document",
  note: "documents.note",
  savedView: "documents.savedview",
  workflow: "documents.workflow",
  user: "auth.user",
} as const;

const KNOWN_IGNORED_PREFIXES = [
  "auth.",
  "contenttypes.",
  "sessions.",
  "admin.",
  "paperless_mail.",
  "account.",
  "socialaccount.",
  "authtoken.",
  "mfa.",
  "otp_",
  "django_",
];
const KNOWN_IGNORED_EXACT = new Set<string>([
  "documents.uisettings",
  "documents.savedviewfilterrule",
  "documents.workflowtrigger",
  "documents.workflowaction",
  "documents.workflowactionemail",
  "documents.workflowactionwebhook",
  "documents.applicationconfiguration",
  "paperless.applicationconfiguration",
]);

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function emptyLedger(): DroppedLedger {
  return {
    notes: 0,
    savedViews: 0,
    workflows: 0,
    droppedCustomFields: 0,
    perDocumentPermissions: 0,
    archiveSerialNumbers: 0,
    trashedDocuments: 0,
    mergedTaxonomy: [],
    unknownModels: {},
  };
}

type RawTaxonomy = { pk: string; name: string; ownerPk: string | null };
type RawTag = RawTaxonomy & { color: string };
type RawStoragePath = RawTaxonomy & { path: string };
type RawDoc = {
  pk: string;
  title: string;
  content: string | null;
  created: unknown;
  added: string | null;
  mimeType: string;
  originalFilename: string | null;
  ownerPk: string | null;
  correspondentPk: string | null;
  typePk: string | null;
  storagePk: string | null;
  tagPks: string[];
  fileRef: string;
};

type ParseResult = { ir: IntermediateRepresentation; analyze: AnalyzeResult };

function mergeGroups(
  kind: string,
  names: string[],
): { kind: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ kind, name, count }));
}

async function parse(zip: ZipSource): Promise<ParseResult> {
  const entries = zip.listEntries();
  const manifestEntries = entries.filter((e) => {
    const base = basename(e.name);
    return base === MANIFEST_BASENAME || base.endsWith(`-${MANIFEST_BASENAME}`);
  });

  const mainManifest = manifestEntries
    .filter((e) => basename(e.name) === MANIFEST_BASENAME)
    .sort((a, b) => a.name.split("/").length - b.name.split("/").length)[0];

  if (!mainManifest) {
    throw new Error("No manifest.json found in the archive — is this a Paperless export?");
  }

  const prefix = mainManifest.name.slice(0, mainManifest.name.length - MANIFEST_BASENAME.length);
  const orderedManifests = [mainManifest, ...manifestEntries.filter((e) => e !== mainManifest)];

  const users = new Map<string, string>();
  const correspondents = new Map<string, string>();
  const rawTags: RawTag[] = [];
  const rawTypes: RawTaxonomy[] = [];
  const rawPaths: RawStoragePath[] = [];
  const customDefs = new Map<string, IRCustomPropertyDef>();
  const customDefTypes = new Map<string, IRCustomPropertyType>();
  const customValuesByDoc = new Map<string, IRCustomValue[]>();
  const rawDocs: RawDoc[] = [];
  const ledger = emptyLedger();

  const dispatch = (rec: ManifestRecord): void => {
    const pk = String(rec.pk);
    const f = rec.fields;

    switch (rec.model) {
      case MODEL.user: {
        const username = asString(f.username);
        if (username) {
          users.set(pk, username);
        }
        return;
      }
      case MODEL.correspondent: {
        const name = asString(f.name);
        if (name) {
          correspondents.set(pk, name);
        }
        return;
      }
      case MODEL.tag: {
        const name = asString(f.name);
        if (name) {
          rawTags.push({
            pk,
            name,
            color: asString(f.color) ?? DEFAULT_TAG_COLOR,
            ownerPk: asRef(f.owner),
          });
        }
        return;
      }
      case MODEL.documentType: {
        const name = asString(f.name);
        if (name) {
          rawTypes.push({ pk, name, ownerPk: asRef(f.owner) });
        }
        return;
      }
      case MODEL.storagePath: {
        const name = asString(f.name);
        if (name) {
          const rawPath = asString(f.path);
          const path = rawPath && !rawPath.includes("{{") ? rawPath : name;
          rawPaths.push({ pk, name, path, ownerPk: asRef(f.owner) });
        }
        return;
      }
      case MODEL.customField: {
        const name = asString(f.name);
        const dataType = asString(f.data_type);
        if (!name || !dataType) {
          return;
        }
        const type = mapCustomFieldType(dataType);
        if (!type) {
          ledger.droppedCustomFields++;
          return;
        }
        const def: IRCustomPropertyDef = { sourceId: pk, name, type };
        if (type === "select") {
          def.selectOptions = parseSelectOptions(f.extra_data);
        }
        customDefs.set(pk, def);
        customDefTypes.set(pk, type);
        return;
      }
      case MODEL.customFieldInstance: {
        const docPk = asRef(f.document);
        const fieldPk = asRef(f.field);
        if (!docPk || !fieldPk) {
          return;
        }
        const type = customDefTypes.get(fieldPk);
        if (!type) {
          return;
        }
        const value = extractCustomValue({ sourceId: fieldPk, type }, f);
        if (value) {
          const list = customValuesByDoc.get(docPk) ?? [];
          list.push(value);
          customValuesByDoc.set(docPk, list);
        }
        return;
      }
      case MODEL.document: {
        if (f.deleted_at != null) {
          ledger.trashedDocuments++;
          return;
        }
        const exportedName = asString(rec[EXPORTER_FILE_NAME_KEY]);
        if (!exportedName) {
          ledger.unknownModels["documents.document(no-file)"] =
            (ledger.unknownModels["documents.document(no-file)"] ?? 0) + 1;
          return;
        }
        if (f.archive_serial_number != null) {
          ledger.archiveSerialNumbers++;
        }
        rawDocs.push({
          pk,
          title: asString(f.title) ?? "",
          content: asString(f.content),
          created: f.created,
          added: asString(f.added),
          mimeType: asString(f.mime_type) ?? "application/octet-stream",
          originalFilename: asString(f.original_filename),
          ownerPk: asRef(f.owner),
          correspondentPk: asRef(f.correspondent),
          typePk: asRef(f.document_type),
          storagePk: asRef(f.storage_path),
          tagPks: asRefArray(f.tags),
          fileRef: prefix + exportedName,
        });
        return;
      }
      case MODEL.note: {
        ledger.notes++;
        return;
      }
      case MODEL.savedView: {
        ledger.savedViews++;
        return;
      }
      case MODEL.workflow: {
        ledger.workflows++;
        return;
      }
      default: {
        if (rec.model.startsWith("guardian.")) {
          ledger.perDocumentPermissions++;
          return;
        }
        if (
          KNOWN_IGNORED_EXACT.has(rec.model) ||
          KNOWN_IGNORED_PREFIXES.some((p) => rec.model.startsWith(p))
        ) {
          return;
        }
        ledger.unknownModels[rec.model] = (ledger.unknownModels[rec.model] ?? 0) + 1;
      }
    }
  };

  for (const manifest of orderedManifests) {
    const stream = await zip.openReadStream(manifest.name);
    for await (const rec of streamManifestRecords(stream)) {
      dispatch(rec);
    }
  }

  const resolveUser = (pk: string | null): string | null =>
    pk === null ? null : (users.get(pk) ?? null);
  const resolveCorrespondent = (pk: string | null): string | null =>
    pk === null ? null : (correspondents.get(pk) ?? null);

  const tags: IRTag[] = rawTags.map((t) => ({
    sourceId: t.pk,
    name: t.name,
    color: t.color,
    owner: resolveUser(t.ownerPk),
  }));
  const documentTypes: IRDocumentType[] = rawTypes.map((t) => ({
    sourceId: t.pk,
    name: t.name,
    owner: resolveUser(t.ownerPk),
  }));
  const storagePaths: IRStoragePath[] = rawPaths.map((p) => ({
    sourceId: p.pk,
    name: p.name,
    path: p.path,
    owner: resolveUser(p.ownerPk),
  }));
  const customPropertyDefs = [...customDefs.values()];

  const documents: IRDocument[] = [];
  const ownerCounts = new Map<string | null, number>();
  const mimeBreakdown: Record<string, number> = {};
  const missingFiles: string[] = [];
  let needsTimezone = false;

  for (const d of rawDocs) {
    const owner = resolveUser(d.ownerPk);
    const documentDate = parseCreatedDate(d.created);
    if (documentDate?.kind === "instant") {
      needsTimezone = true;
    }
    if (!zip.hasEntry(d.fileRef)) {
      missingFiles.push(d.fileRef);
    }
    mimeBreakdown[d.mimeType] = (mimeBreakdown[d.mimeType] ?? 0) + 1;
    ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);

    documents.push({
      sourceId: d.pk,
      title: d.title || d.originalFilename || "Untitled",
      fileRef: d.fileRef,
      mimeType: d.mimeType,
      originalFilename: d.originalFilename,
      documentDate,
      createdAt: d.added,
      ocrText: d.content,
      correspondent: resolveCorrespondent(d.correspondentPk),
      typeRef: d.typePk,
      storagePathRef: d.storagePk,
      tagRefs: d.tagPks,
      customValues: customValuesByDoc.get(d.pk) ?? [],
      owner,
    });
  }

  ledger.mergedTaxonomy = [
    ...mergeGroups(
      "tag",
      tags.map((t) => t.name),
    ),
    ...mergeGroups(
      "documentType",
      documentTypes.map((t) => t.name),
    ),
    ...mergeGroups(
      "storagePath",
      storagePaths.map((p) => p.path),
    ),
    ...mergeGroups(
      "customField",
      customPropertyDefs.map((d) => d.name),
    ),
  ];

  const ownerBreakdown = [...ownerCounts.entries()]
    .map(([owner, count]) => ({ owner, documents: count }))
    .sort((a, b) => b.documents - a.documents);

  const ir: IntermediateRepresentation = {
    documents,
    documentTypes,
    storagePaths,
    tags,
    customPropertyDefs,
  };

  const analyze: AnalyzeResult = {
    counts: {
      documents: documents.length,
      tags: tags.length,
      documentTypes: documentTypes.length,
      storagePaths: storagePaths.length,
      customPropertyDefs: customPropertyDefs.length,
    },
    ledger,
    ownerBreakdown,
    missingFiles,
    mimeBreakdown,
    needsTimezone,
  };

  return { ir, analyze };
}

export const paperlessAdapter: SourceAdapter = {
  source: SOURCE,

  identify: (zip) =>
    Promise.resolve(zip.listEntries().some((e) => basename(e.name) === MANIFEST_BASENAME)),

  analyze: async (zip) => (await parse(zip)).analyze,

  buildIntermediate: async (zip) => (await parse(zip)).ir,
};
