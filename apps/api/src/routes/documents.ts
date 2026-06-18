import { zValidator } from "@hono/zod-validator";
import { recordEvent } from "@omnipaper/database/activity";
import { db } from "@omnipaper/database/client";
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
  getOrgDocument,
  markDocumentOcrPending,
  updateDocument,
  updateDocumentOcrText,
} from "@omnipaper/database/queries/documents";
import { getOrgStoragePath } from "@omnipaper/database/queries/storage-paths";
import {
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
} from "@omnipaper/shared/document-filters";
import { describeAcceptedFormats, isUploadAllowed } from "@omnipaper/shared/formats";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { customPropertyRegistry } from "../custom-properties/registry";
import { errors } from "../errors";
import { ingestDocument } from "../lib/ingest";
import { getStorageDriver } from "../lib/storage";
import { requireOrgPermission } from "../middleware";
import { shapeDocumentProperties } from "../serializers/custom-property";
import { toDocumentDetailDto, toDocumentListItemDto } from "../serializers/document";
import { toTagRefDto } from "../serializers/tag";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const listDocumentsQuerySchema = z.object({
  q: z.string().optional(),
  // Opaque pagination token from a previous response's `nextCursor` (currently an absolute offset).
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
            code: z.ZodIssueCode.custom,
            message: `Unknown filter key(s): ${unknown.join(", ")}`,
          });
          return z.NEVER;
        }
        return parsed;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid filters" });
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid sort" });
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
  documentDate: z.string().date().nullable().optional(),
  documentTypeId: z.string().min(1).nullable().optional(),
  storagePathId: z.string().min(1).nullable().optional(),
});
const updateOcrTextSchema = z.object({
  ocrText: z.string().max(1000000),
});
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
    // The cursor is an opaque token wrapping an absolute row offset; decode defensively.
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
    // A full page means there may be more; an opaque token pointing at the next offset. null = end.
    const nextCursor =
      rows.length === DEFAULT_PAGE_SIZE ? String(offset + DEFAULT_PAGE_SIZE) : null;
    return c.json({ documents, nextCursor });
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
    const object = await driver.getObject({ key: `${doc.storageKey}.thumb.png` });
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
