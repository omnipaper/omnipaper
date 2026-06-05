import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  createDocument,
  deleteDocument,
  getDocumentActivity,
  getDocuments,
  getOrgDocument,
} from "@omnipaper/database/queries/documents";
import { enqueue } from "@omnipaper/queue/producer";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { getStorageDriver } from "../lib/storage";
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

export const documentsRoutes = new Hono<{ Variables: Variables }>()
  .post("/", zValidator("json", createDocumentSchema), async (c) => {
    const user = c.get("user");

    if (!user) {
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
    const documents = await getDocuments(db, {
      organizationId,
      query: c.req.valid("query").q,
    });

    return c.json({ documents });
  })
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const doc = await getOrgDocument(db, { organizationId, id: c.req.param("id") });

    if (!doc) {
      throw errors.notFound("Document not found");
    }

    return c.json({ document: toDocumentDto(doc) });
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

    const { url } = await driver.createDownloadUrl({ key: doc.storageKey });

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
  .delete("/:id", async (c) => {
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
