import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  clearDocumentPropertyValue,
  getDocumentPropertyValues,
  getOrgPropertyDefinition,
  getOrgPropertyDefinitions,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import {
  createDocument,
  deleteDocument,
  getDocumentActivity,
  getDocuments,
  getOrgDocument,
} from "@omnipaper/database/queries/documents";
import {
  getOrgTagsByIds,
  getTagsByDocumentIds,
  setDocumentTags,
} from "@omnipaper/database/queries/tags";
import { enqueue } from "@omnipaper/queue/producer";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { customPropertyRegistry } from "../custom-properties/registry";
import { errors } from "../errors";
import { getStorageDriver } from "../lib/storage";
import { requireOrgPermission } from "../middleware";
import { shapeDocumentProperties } from "../serializers/custom-property";
import { toDocumentDto } from "../serializers/document";

const createDocumentSchema = z.object({
  title: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const listDocumentsQuerySchema = z.object({
  q: z.string().optional(),
});

const setDocumentTagsSchema = z.object({
  tagIds: z.array(z.string()).max(50),
});

// The value's real shape depends on the property type, so it's validated by the type registry in
// the handler; here we only require the key to be present.
const setPropertyValueSchema = z.object({
  value: z.unknown(),
});

export const documentsRoutes = new Hono<{ Variables: Variables }>()
  .post("/", zValidator("json", createDocumentSchema), async (c) => {
    const user = c.get("user");

    if (!user) { // typescript: the middleware ensures user is present, but we need to satisfy the type checker
      throw errors.unauthorized();
    }

    const organizationId = c.get("organizationId");
    const values = c.req.valid("json");
    const driver = await getStorageDriver();

    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }

    const id = createId("doc");
    const storageKey = `${organizationId}/${id}`;

    const { url } = await driver.createUploadUrl({
      key: storageKey,
      contentType: values.mimeType,
    });

    await createDocument(db, {
      id,
      organizationId,
      createdBy: user.id,
      title: values.title,
      storageKey,
      mimeType: values.mimeType,
      sizeBytes: values.sizeBytes,
    });

    return c.json({ documentId: id, uploadUrl: url });
  })
  .get("/", zValidator("query", listDocumentsQuerySchema), async (c) => {
    const organizationId = c.get("organizationId");
    const rows = await getDocuments(db, {
      organizationId,
      query: c.req.valid("query").q,
    });

    const tagRows = await getTagsByDocumentIds(db, { documentIds: rows.map((d) => d.id) });
    const tagsByDocument = new Map<string, { id: string; name: string; color: string }[]>();

    for (const row of tagRows) {
      const list = tagsByDocument.get(row.documentId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color });
      tagsByDocument.set(row.documentId, list);
    }

    const documents = rows.map((d) => ({ ...d, tags: tagsByDocument.get(d.id) ?? [] }));

    return c.json({ documents });
  })
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });

    if (!doc) {
      throw errors.notFound("Document not found");
    }

    const tagRows = await getTagsByDocumentIds(db, { documentIds: [doc.id] });
    const tags = tagRows.map((row) => ({ id: row.id, name: row.name, color: row.color }));

    const definitions = await getOrgPropertyDefinitions(db, { organizationId });
    const valueRows = await getDocumentPropertyValues(db, { documentId: doc.id });
    const customProperties = shapeDocumentProperties(definitions, valueRows);

    return c.json({ document: { ...toDocumentDto(doc), tags, customProperties } });
  })
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
  .put("/:id/tags", zValidator("json", setDocumentTagsSchema), async (c) => {
    const organizationId = c.get("organizationId");
    const documentId = c.req.param("id");
    const doc = await getOrgDocument(db, { organizationId, id: documentId });

    if (!doc) {
      throw errors.notFound("Document not found");
    }

    const tagIds = [...new Set(c.req.valid("json").tagIds)];

    if (tagIds.length > 0) {
      // Verify every id is one of this org's tags, so a caller can't attach another tenant's tag.
      const owned = await getOrgTagsByIds(db, { organizationId, ids: tagIds });

      if (owned.length !== tagIds.length) {
        throw errors.badRequest(
          "invalid_tags",
          "One or more tags do not belong to this organization",
        );
      }
    }

    await setDocumentTags(db, { documentId, tagIds });

    const tagRows = await getTagsByDocumentIds(db, { documentIds: [documentId] });
    const tags = tagRows.map((row) => ({ id: row.id, name: row.name, color: row.color }));

    return c.json({ tags });
  })
  .put(
    "/:id/custom-properties/:definitionId",
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

      return c.json({ ok: true });
    },
  )
  .delete("/:id/custom-properties/:definitionId", async (c) => {
    const organizationId = c.get("organizationId");
    const documentId = c.req.param("id");
    const doc = await getOrgDocument(db, { organizationId, id: documentId });

    if (!doc) {
      throw errors.notFound("Document not found");
    }

    await clearDocumentPropertyValue(db, { documentId, definitionId: c.req.param("definitionId") });

    return c.json({ ok: true });
  })
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
  .post("/:id/process", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });

    if (!doc) {
      throw errors.notFound("Document not found");
    }

    await enqueue("ocr-extract", { documentId: doc.id });

    return c.json({ ok: true });
  });
