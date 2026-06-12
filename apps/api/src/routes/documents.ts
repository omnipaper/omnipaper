import { zValidator } from "@hono/zod-validator";
import { recordEvent } from "@omnipaper/database/activity";
import { db } from "@omnipaper/database/client";
import {
  clearDocumentPropertyValue,
  getDocumentPropertyValues,
  getOrgPropertyDefinition,
  getOrgPropertyDefinitions,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentType } from "@omnipaper/database/queries/document-types";
import {
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

// Uploads are buffered in memory to hash before storing, so cap the size to bound peak memory.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const listDocumentsQuerySchema = z.object({
  q: z.string().optional(),
  // Folder-view filters. `storagePathId` scopes to one path; `unfiled=true` to documents with
  // none. Query values are strings, so `unfiled` is matched as the literal "true".
  storagePathId: z.string().min(1).optional(),
  unfiled: z.literal("true").optional(),
});

const setDocumentTagsSchema = z.object({
  tagIds: z.array(z.string()).max(50),
});

// The value's real shape depends on the property type, so it's validated by the type registry in
// the handler; here we only require the key to be present.
const setPropertyValueSchema = z.object({
  value: z.unknown(),
});

const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  documentDate: z.string().date().nullable().optional(),
  // null clears the field; a non-empty id assigns it. Reject "" so a bad payload is a clean 400,
  // not a DB-level FK 500 (the ownership guard below uses a truthy check that "" would skip).
  documentTypeId: z.string().min(1).nullable().optional(),
  storagePathId: z.string().min(1).nullable().optional(),
});

// Manual OCR-text correction. Capped well above any real transcript to bound abuse; the column
// itself is unbounded text.
const updateOcrTextSchema = z.object({
  ocrText: z.string().max(1_000_000),
});

export const documentsRoutes = new Hono<{ Variables: Variables }>()
  .post("/", requireOrgPermission({ documents: ["create"] }), async (c) => {
    const user = c.get("user");

    if (!user) {
      // typescript: the middleware ensures user is present, but we need to satisfy the type checker
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
    const { q, storagePathId, unfiled } = c.req.valid("query");
    const rows = await getDocuments(db, {
      organizationId,
      query: q,
      storagePathId,
      unfiled: unfiled === "true",
    });

    const tagRows = await getTagsByDocumentIds(db, { documentIds: rows.map((d) => d.id) });
    const tagsByDocument = new Map<string, ReturnType<typeof toTagRefDto>[]>();

    for (const row of tagRows) {
      const list = tagsByDocument.get(row.documentId) ?? [];
      list.push(toTagRefDto(row));
      tagsByDocument.set(row.documentId, list);
    }

    const documents = rows.map((d) => toDocumentListItemDto(d, tagsByDocument.get(d.id) ?? []));

    return c.json({ documents });
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

    // Resolve the assigned type/path so the detail is self-contained (the picker needs the id,
    // the UI shows the name/path). The serializer owns the embedded shape.
    const documentType = doc.documentTypeId
      ? await getOrgDocumentType(db, { organizationId, id: doc.documentTypeId })
      : null;
    const storagePath = doc.storagePathId
      ? await getOrgStoragePath(db, { organizationId, id: doc.storagePathId })
      : null;

    // Can the active OCR engine read this MIME type? Drives the re-run affordance — an unsupported
    // type can never be extracted, so the UI disables it rather than offering a doomed re-run.
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

    // 1h: the in-browser PDF preview keeps this URL for the whole viewing session (pdf.js may
    // issue range requests minutes after load), so a short expiry would break it mid-read.
    const { url } = await driver.createDownloadUrl({
      key: doc.storageKey,
      expiresInSeconds: 60 * 60,
    });

    return c.json({ downloadUrl: url });
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

      // Verify every id is one of this org's tags, so a caller can't attach another tenant's tag.
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

      // For select, the value is an option id — verify it belongs to THIS property.
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

    // Backstop for the case the UI already hides: an unsupported MIME can never be extracted, so
    // refuse the re-run instead of queuing a job guaranteed to fail.
    const { definitionId } = await getOcrSettings();
    if (!supportsMime(definitionId, doc.mimeType)) {
      throw errors.badRequest(
        "ocr_unsupported",
        "The configured OCR engine can't process this file type",
      );
    }

    // Reset the status before enqueue so a re-run immediately reads as in-progress instead of its
    // prior completed/failed state; the worker flips it to "processing" when it picks the job up.
    await markDocumentOcrPending(db, { id: doc.id });
    await enqueue("ocr-extract", { documentId: doc.id });

    return c.json({ ok: true });
  });
