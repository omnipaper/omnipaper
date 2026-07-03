import { zValidator } from "@hono/zod-validator";
import { recordEvent } from "@omnipaper/database/activity";
import { db } from "@omnipaper/database/client";
import {
  dismissSuggestionsForField,
  getPendingSuggestions,
  getSuggestionById,
  setSuggestionStatus,
} from "@omnipaper/database/queries/ai-suggestions";
import {
  clearDocumentPropertyValue,
  getDocumentPropertyValues,
  getOrgCustomPropertyTypes,
  getOrgPropertyDefinition,
  getOrgPropertyDefinitions,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentType } from "@omnipaper/database/queries/document-types";
import {
  DEFAULT_PAGE_SIZE,
  deleteDocument,
  getDocumentActivity,
  getDocuments,
  getDocumentsForExport,
  getOrgDocument,
  markDocumentOcrPending,
  updateDocument,
  updateDocumentOcrText,
} from "@omnipaper/database/queries/documents";
import { getOrgStoragePath } from "@omnipaper/database/queries/storage-paths";
import {
  addDocumentTag,
  createTag,
  getOrgTagsByIds,
  getTagsByDocumentIds,
  setDocumentTags,
} from "@omnipaper/database/queries/tags";
import { supportsMime } from "@omnipaper/ocr/resolve";
import { enqueue } from "@omnipaper/queue/producer";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import {
  decodeSort,
  filterStateSchema,
  isKnownFilterKey,
  sortStateSchema,
} from "@omnipaper/shared/document-filters";
import {
  describeAcceptedFormats,
  extensionForMimeType,
  isUploadAllowed,
} from "@omnipaper/shared/formats";
import type { AiSuggestionValue } from "@omnipaper/shared/workflows/ai-assign";
import { Zip, ZipPassThrough } from "fflate";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import {
  coerceCustomValue,
  customPropertyRegistry,
  type ValueColumns,
} from "../lib/custom-property-registry";
import { ingestDocument } from "../lib/ingest";
import { getStorageDriver } from "../lib/storage";
import { requireOrgPermission } from "../middleware";
import { shapeDocumentProperties } from "../serializers/custom-property";
import { toDocumentDetailDto, toDocumentListItemDto } from "../serializers/document";
import { toTagRefDto } from "../serializers/tag";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const listDocumentsQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
  filters: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = filterStateSchema.parse(JSON.parse(raw));
        const unknown = Object.keys(parsed).filter((key) => !isKnownFilterKey(key));
        if (unknown.length > 0) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown filter key(s): ${unknown.join(", ")}`,
          });
          return z.NEVER;
        }
        return parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid filters" });
        return z.NEVER;
      }
    }),
  sort: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) {
        return undefined;
      }
      const parsed = decodeSort(raw);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "Invalid sort" });
        return z.NEVER;
      }
      return parsed;
    }),
});
const setDocumentTagsSchema = z.object({
  tagIds: z.array(z.string()).max(50),
});
const setPropertyValueSchema = z.object({
  value: z.unknown(),
});
const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  documentDate: z.iso.date().nullable().optional(),
  documentTypeId: z.string().min(1).nullable().optional(),
  storagePathId: z.string().min(1).nullable().optional(),
});
const updateOcrTextSchema = z.object({
  ocrText: z.string().max(1000000),
});
const exportDocumentsSchema = z.union([
  z.object({ documents: z.array(z.string().min(1)).min(1) }),
  z.object({
    all: z.literal(true),
    q: z.string().optional(),
    filters: filterStateSchema.optional(),
    sort: sortStateSchema.optional(),
  }),
]);
function exportFileName(
  doc: { id: string; title: string; originalFilename: string | null; mimeType: string },
  used: Set<string>,
): string {
  const raw = (doc.originalFilename ?? doc.title ?? doc.id).replace(/[\\/:*?"<>|]/g, "_").trim();
  const safe = raw || doc.id;
  const hasExt = safe.lastIndexOf(".") > 0;
  let name = hasExt ? safe : safe + (extensionForMimeType(doc.mimeType) ?? "");
  if (used.has(name)) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let i = 2;
    while (used.has(`${stem} (${i})${ext}`)) {
      i++;
    }
    name = `${stem} (${i})${ext}`;
  }
  used.add(name);
  return name;
}
async function applySuggestionValue(
  organizationId: string,
  documentId: string,
  field: string,
  value: AiSuggestionValue,
  definitionId: string | null,
): Promise<void> {
  if ((field === "documentType" || field === "storagePath") && "id" in value) {
    if (field === "documentType") {
      if (!(await getOrgDocumentType(db, { organizationId, id: value.id }))) {
        throw errors.badRequest("invalid_document_type", "Document type no longer exists");
      }
      await updateDocument(db, { organizationId, id: documentId, documentTypeId: value.id });
    } else {
      if (!(await getOrgStoragePath(db, { organizationId, id: value.id }))) {
        throw errors.badRequest("invalid_storage_path", "Storage path no longer exists");
      }
      await updateDocument(db, { organizationId, id: documentId, storagePathId: value.id });
    }
    return;
  }

  if ((field === "title" || field === "documentDate") && "value" in value) {
    await updateDocument(db, {
      organizationId,
      id: documentId,
      ...(field === "title" ? { title: value.value } : { documentDate: value.value }),
    });
    return;
  }

  if (field === "tags" && "existingIds" in value) {
    const owned = value.existingIds.length
      ? await getOrgTagsByIds(db, { organizationId, ids: value.existingIds })
      : [];
    for (const tag of owned) {
      await addDocumentTag(db, { documentId, tagId: tag.id });
    }
    for (const name of value.newNames) {
      const tag = await createTag(db, { organizationId, name });
      await addDocumentTag(db, { documentId, tagId: tag.id });
    }
  }

  if (field === "customProperty" && definitionId) {
    const found = await getOrgPropertyDefinition(db, { organizationId, id: definitionId });
    if (!found) {
      throw errors.badRequest("invalid_property", "Custom property no longer exists");
    }
    let columns: ValueColumns | null = null;
    if ("selectOptionId" in value) {
      if (!found.options.some((o) => o.id === value.selectOptionId)) {
        throw errors.badRequest("invalid_option", "Option no longer exists");
      }
      columns = customPropertyRegistry.select.toDb(value.selectOptionId);
    } else if ("value" in value) {
      columns = coerceCustomValue(found.definition.type, found.options, value.value);
    }
    if (columns) {
      await setDocumentPropertyValue(db, { documentId, definitionId, values: columns });
    }
  }
}

export const documentsRoutes = new Hono<{
  Variables: Variables;
}>()
  .post("/", requireOrgPermission({ documents: ["create"] }), async (c) => {
    const user = c.get("user");
    if (!user) {
      throw errors.unauthorized();
    }
    const organizationId = c.get("organizationId");
    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File) || file.size === 0) {
      throw errors.badRequest("file_required", "A file is required");
    }
    if (!isUploadAllowed({ filename: file.name, mimeType: file.type })) {
      throw errors.badRequest(
        "unsupported_file_type",
        `Unsupported file type. Accepted formats: ${describeAcceptedFormats()}.`,
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw errors.badRequest(
        "file_too_large",
        `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB upload limit`,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ingestDocument({
      db,
      driver,
      organizationId,
      createdBy: user.id,
      bytes,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    return c.json(result);
  })
  .get("/", zValidator("query", listDocumentsQuerySchema), async (c) => {
    const organizationId = c.get("organizationId");
    const { q, cursor, filters, sort } = c.req.valid("query");
    const parsedOffset = cursor ? Number.parseInt(cursor, 10) : 0;
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
    const customPropertyTypes =
      filters && Object.keys(filters).some((key) => key.startsWith("cp:"))
        ? new Map(
            (await getOrgCustomPropertyTypes(db, { organizationId })).map(
              (d) => [d.id, d.type] as const,
            ),
          )
        : undefined;
    const rows = await getDocuments(db, {
      organizationId,
      query: q,
      filters,
      sort,
      customPropertyTypes,
      limit: DEFAULT_PAGE_SIZE,
      offset,
    });
    const tagRows = await getTagsByDocumentIds(db, { documentIds: rows.map((d) => d.id) });
    const tagsByDocument = new Map<string, ReturnType<typeof toTagRefDto>[]>();
    for (const row of tagRows) {
      const list = tagsByDocument.get(row.documentId) ?? [];
      list.push(toTagRefDto(row));
      tagsByDocument.set(row.documentId, list);
    }
    const documents = rows.map((d) => toDocumentListItemDto(d, tagsByDocument.get(d.id) ?? []));
    const nextCursor =
      rows.length === DEFAULT_PAGE_SIZE ? String(offset + DEFAULT_PAGE_SIZE) : null;
    return c.json({ documents, nextCursor });
  })
  .post("/export", zValidator("json", exportDocumentsSchema), async (c) => {
    const organizationId = c.get("organizationId");
    const body = c.req.valid("json");
    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }
    const customPropertyTypes =
      "all" in body && body.filters && Object.keys(body.filters).some((k) => k.startsWith("cp:"))
        ? new Map(
            (await getOrgCustomPropertyTypes(db, { organizationId })).map(
              (d) => [d.id, d.type] as const,
            ),
          )
        : undefined;
    const docs = await getDocumentsForExport(
      db,
      "documents" in body
        ? { organizationId, ids: body.documents }
        : {
            organizationId,
            query: body.q,
            filters: body.filters,
            sort: body.sort,
            customPropertyTypes,
          },
    );
    if (docs.length === 0) {
      throw errors.badRequest("no_documents", "No documents to export");
    }
    const used = new Set<string>();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const zip = new Zip((err, chunk, final) => {
          if (err) {
            controller.error(err);
            return;
          }
          controller.enqueue(chunk);
          if (final) {
            controller.close();
          }
        });
        (async () => {
          try {
            for (const doc of docs) {
              const obj = await driver.getObject({ key: doc.storageKey });
              if (!obj) {
                continue;
              }
              const entry = new ZipPassThrough(exportFileName(doc, used));
              zip.add(entry);
              entry.push(new Uint8Array(obj.body), true);
            }
            zip.end();
          } catch (e) {
            controller.error(e as Error);
          }
        })();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="documents.zip"',
      },
    });
  })
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });
    if (!doc) {
      throw errors.notFound("Document not found");
    }
    const tagRows = await getTagsByDocumentIds(db, { documentIds: [doc.id] });
    const tags = tagRows.map(toTagRefDto);
    const definitions = await getOrgPropertyDefinitions(db, { organizationId });
    const valueRows = await getDocumentPropertyValues(db, { documentId: doc.id });
    const customProperties = shapeDocumentProperties(definitions, valueRows);
    const documentType = doc.documentTypeId
      ? await getOrgDocumentType(db, { organizationId, id: doc.documentTypeId })
      : null;
    const storagePath = doc.storagePathId
      ? await getOrgStoragePath(db, { organizationId, id: doc.storagePathId })
      : null;
    const { definitionId } = await getOcrSettings();
    const ocrSupported = supportsMime(definitionId, doc.mimeType);
    return c.json({
      document: toDocumentDetailDto({
        document: doc,
        tags,
        customProperties,
        documentType,
        storagePath,
        ocrSupported,
      }),
    });
  })
  .patch(
    "/:id",
    requireOrgPermission({ documents: ["update"] }),
    zValidator("json", updateDocumentSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");
      const doc = await getOrgDocument(db, { organizationId, id });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      const values = c.req.valid("json");
      if (values.documentTypeId) {
        const found = await getOrgDocumentType(db, { organizationId, id: values.documentTypeId });
        if (!found) {
          throw errors.badRequest(
            "invalid_document_type",
            "Document type does not belong to this organization",
          );
        }
      }
      if (values.storagePathId) {
        const found = await getOrgStoragePath(db, { organizationId, id: values.storagePathId });
        if (!found) {
          throw errors.badRequest(
            "invalid_storage_path",
            "Storage path does not belong to this organization",
          );
        }
      }
      await updateDocument(db, { organizationId, id, ...values });
      const supersededField: Record<
        string,
        "documentType" | "storagePath" | "title" | "documentDate"
      > = {
        documentTypeId: "documentType",
        storagePathId: "storagePath",
        title: "title",
        documentDate: "documentDate",
      };
      for (const key of Object.keys(values)) {
        const field = supersededField[key];
        if (field) {
          await dismissSuggestionsForField(db, { documentId: id, field });
        }
      }
      await recordEvent(db, {
        organizationId,
        resource: { type: "document", id, label: doc.title },
        event: "document.metadata_updated",
        actor: { type: "user", id: c.get("user")?.id },
        data: { updatedFields: Object.keys(values) },
      });
      return c.json({ ok: true });
    },
  )
  .put(
    "/:id/ocr-text",
    requireOrgPermission({ documents: ["update"] }),
    zValidator("json", updateOcrTextSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id");
      const doc = await getOrgDocument(db, { organizationId, id });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      await updateDocumentOcrText(db, { organizationId, id, ocrText: c.req.valid("json").ocrText });
      return c.json({ ok: true });
    },
  )
  .get("/:id/download", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });
    if (!doc) {
      throw errors.notFound("Document not found");
    }
    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }
    const { url } = await driver.createDownloadUrl({
      key: doc.storageKey,
      expiresInSeconds: 60 * 60,
    });
    return c.json({ downloadUrl: url });
  })
  .get("/:id/thumb", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });
    if (!doc) {
      throw errors.notFound("Document not found");
    }
    const etag = `"${doc.sha256}-t1"`;
    const cacheControl = "private, max-age=86400";
    if (c.req.header("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": cacheControl },
      });
    }
    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }
    const key = doc.mimeType.startsWith("image/") ? doc.storageKey : `${doc.storageKey}.thumb.png`;
    const object = await driver.getObject({ key });
    if (!object) {
      throw errors.notFound("Thumbnail not available");
    }
    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": object.contentType ?? "image/png",
        "Cache-Control": cacheControl,
        ETag: etag,
      },
    });
  })
  .get("/:id/activity", async (c) => {
    const organizationId = c.get("organizationId");
    const activities = await getDocumentActivity(db, {
      organizationId,
      documentId: c.req.param("id"),
    });
    return c.json({ activities });
  })
  .get("/:id/suggestions", async (c) => {
    const organizationId = c.get("organizationId");
    const documentId = c.req.param("id");
    if (!(await getOrgDocument(db, { organizationId, id: documentId }))) {
      throw errors.notFound("Document not found");
    }
    const suggestions = await getPendingSuggestions(db, { documentId });
    return c.json({ suggestions });
  })
  .post(
    "/:id/suggestions/:suggestionId/accept",
    requireOrgPermission({ documents: ["update"] }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const documentId = c.req.param("id");
      const suggestionId = c.req.param("suggestionId");
      const doc = await getOrgDocument(db, { organizationId, id: documentId });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      const suggestion = await getSuggestionById(db, { id: suggestionId, documentId });
      if (!suggestion) {
        throw errors.notFound("Suggestion not found");
      }
      await applySuggestionValue(
        organizationId,
        documentId,
        suggestion.field,
        suggestion.suggestedValue,
        suggestion.customPropertyDefinitionId,
      );
      await setSuggestionStatus(db, { id: suggestionId, documentId, status: "accepted" });
      const event =
        suggestion.field === "tags"
          ? "document.tags_updated"
          : suggestion.field === "customProperty"
            ? "document.property_updated"
            : "document.metadata_updated";
      await recordEvent(db, {
        organizationId,
        resource: { type: "document", id: documentId, label: doc.title },
        event,
        actor: { type: "user", id: c.get("user")?.id },
        data:
          suggestion.field === "tags"
            ? { source: "ai-accept" }
            : suggestion.field === "customProperty"
              ? {
                  updatedDefinitions: suggestion.customPropertyDefinitionId
                    ? [suggestion.customPropertyDefinitionId]
                    : [],
                }
              : { updatedFields: [suggestion.field] },
      });
      return c.json({ ok: true });
    },
  )
  .post(
    "/:id/suggestions/:suggestionId/dismiss",
    requireOrgPermission({ documents: ["update"] }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const documentId = c.req.param("id");
      if (!(await getOrgDocument(db, { organizationId, id: documentId }))) {
        throw errors.notFound("Document not found");
      }
      await setSuggestionStatus(db, {
        id: c.req.param("suggestionId"),
        documentId,
        status: "dismissed",
      });
      return c.json({ ok: true });
    },
  )
  .put(
    "/:id/tags",
    requireOrgPermission({ documents: ["update"] }),
    zValidator("json", setDocumentTagsSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const documentId = c.req.param("id");
      const doc = await getOrgDocument(db, { organizationId, id: documentId });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      const tagIds = [...new Set(c.req.valid("json").tagIds)];
      const owned =
        tagIds.length > 0 ? await getOrgTagsByIds(db, { organizationId, ids: tagIds }) : [];
      if (owned.length !== tagIds.length) {
        throw errors.badRequest(
          "invalid_tags",
          "One or more tags do not belong to this organization",
        );
      }
      const currentTagRows = await getTagsByDocumentIds(db, { documentIds: [documentId] });
      const currentTagIdSet = new Set(currentTagRows.map((t) => t.id));
      const newTagIdSet = new Set(tagIds);
      await setDocumentTags(db, { documentId, tagIds });
      const tagRows = await getTagsByDocumentIds(db, { documentIds: [documentId] });
      const tags = tagRows.map(toTagRefDto);
      const addedTags = owned.filter((t) => !currentTagIdSet.has(t.id));
      const removedTags = currentTagRows.filter((t) => !newTagIdSet.has(t.id));
      if (addedTags.length > 0 || removedTags.length > 0) {
        await recordEvent(db, {
          organizationId,
          resource: { type: "document", id: documentId, label: doc.title },
          event: "document.tags_updated",
          actor: { type: "user", id: c.get("user")?.id },
          data: {
            added: addedTags.map((t) => ({ tagId: t.id, tagName: t.name })),
            removed: removedTags.map((t) => ({ tagId: t.id, tagName: t.name })),
          },
        });
      }
      await dismissSuggestionsForField(db, { documentId, field: "tags" });
      return c.json({ tags });
    },
  )
  .put(
    "/:id/custom-properties/:definitionId",
    requireOrgPermission({ documents: ["update"] }),
    zValidator("json", setPropertyValueSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const documentId = c.req.param("id");
      const definitionId = c.req.param("definitionId");
      const doc = await getOrgDocument(db, { organizationId, id: documentId });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      const found = await getOrgPropertyDefinition(db, { organizationId, id: definitionId });
      if (!found) {
        throw errors.notFound("Property not found");
      }
      const definition = customPropertyRegistry[found.definition.type];
      const parsed = definition.inputSchema.safeParse(c.req.valid("json").value);
      if (!parsed.success) {
        throw errors.badRequest(
          "invalid_value",
          parsed.error.issues[0]?.message ?? "Invalid value",
        );
      }
      if (definition.hasOptions && !found.options.some((o) => o.id === parsed.data)) {
        throw errors.badRequest("invalid_option", "Option does not belong to this property");
      }
      await setDocumentPropertyValue(db, {
        documentId,
        definitionId,
        values: definition.toDb(parsed.data),
      });
      await recordEvent(db, {
        organizationId,
        resource: { type: "document", id: documentId, label: doc.title },
        event: "document.property_updated",
        actor: { type: "user", id: c.get("user")?.id },
        data: { updatedDefinitions: [definitionId] },
      });
      return c.json({ ok: true });
    },
  )
  .delete(
    "/:id/custom-properties/:definitionId",
    requireOrgPermission({ documents: ["update"] }),
    async (c) => {
      const organizationId = c.get("organizationId");
      const documentId = c.req.param("id");
      const definitionId = c.req.param("definitionId");
      const doc = await getOrgDocument(db, { organizationId, id: documentId });
      if (!doc) {
        throw errors.notFound("Document not found");
      }
      await clearDocumentPropertyValue(db, { documentId, definitionId });
      await recordEvent(db, {
        organizationId,
        resource: { type: "document", id: documentId, label: doc.title },
        event: "document.property_updated",
        actor: { type: "user", id: c.get("user")?.id },
        data: { updatedDefinitions: [definitionId] },
      });
      return c.json({ ok: true });
    },
  )
  .delete("/:id", requireOrgPermission({ documents: ["delete"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });
    if (!doc) {
      throw errors.notFound("Document not found");
    }
    const driver = await getStorageDriver();
    if (driver) {
      await driver.deleteObject({ key: doc.storageKey });
      await driver.deleteObject({ key: `${doc.storageKey}.thumb.png` });
    }
    await deleteDocument(db, { id: doc.id });
    return c.json({ ok: true });
  })
  .post("/:id/process", requireOrgPermission({ documents: ["update"] }), async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });
    if (!doc) {
      throw errors.notFound("Document not found");
    }
    const { definitionId } = await getOcrSettings();
    if (!supportsMime(definitionId, doc.mimeType)) {
      throw errors.badRequest(
        "ocr_unsupported",
        "The configured OCR engine can't process this file type",
      );
    }
    await markDocumentOcrPending(db, { id: doc.id });
    await enqueue("ocr-extract", { documentId: doc.id });
    return c.json({ ok: true });
  });
