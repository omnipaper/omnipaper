import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { type FieldChangeInput, recordFieldChanges } from "@omnipaper/database/field-changes";
import {
  dismissSuggestionsForField,
  getPendingSuggestions,
  getSuggestionById,
  setSuggestionStatus,
} from "@omnipaper/database/queries/ai-suggestions";
import {
  addPropertyOption,
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
  deleteDocuments,
  getDocumentActivity,
  getDocumentIds,
  getDocuments,
  getDocumentsForExport,
  getOrgDocument,
  getOrgDocumentStorageKeys,
  markDocumentOcrPending,
  updateDocument,
  updateDocumentOcrText,
} from "@omnipaper/database/queries/documents";
import {
  createStoragePath,
  getOrgStoragePath,
  getOrgStoragePaths,
} from "@omnipaper/database/queries/storage-paths";
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
  isUploadAllowed,
  MAX_UPLOAD_BYTES,
} from "@omnipaper/shared/formats";
import { isValidStoragePath, normalizeStoragePath } from "@omnipaper/shared/storage-paths";
import type { AiSuggestionValue } from "@omnipaper/shared/workflows/ai-assign";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors, PasswordProtectedPdfError } from "../errors";
import {
  coerceCustomValue,
  customPropertyRegistry,
  propertyChangeSnapshot,
  type ValueColumns,
} from "../lib/custom-property-registry";
import { createDocumentsZipStream } from "../lib/export";
import { ingestDocument } from "../lib/ingest";
import { getStorageDriver } from "../lib/storage";
import { requireOrgPermission } from "../middleware";
import { shapeDocumentProperties } from "../serializers/custom-property";
import { toDocumentDetailDto, toDocumentListItemDto } from "../serializers/document";
import { toTagRefDto } from "../serializers/tag";

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
// Explicit ids only: deletion here is permanent (row plus stored objects, no trash), so the
// "all matching" shape that /export accepts is deliberately not offered.
const deleteDocumentsSchema = z.object({
  documents: z.array(z.string().min(1)).min(1),
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
type SuggestionTargetDoc = {
  id: string;
  title: string;
  documentDate: string | null;
  documentTypeId: string | null;
  storagePathId: string | null;
};

async function applySuggestionValue(
  organizationId: string,
  doc: SuggestionTargetDoc,
  field: string,
  value: AiSuggestionValue,
  definitionId: string | null,
  userId: string | null,
): Promise<void> {
  const documentId = doc.id;
  const changes: FieldChangeInput[] = [];

  if ((field === "documentType" || field === "storagePath") && "id" in value) {
    if (field === "documentType") {
      const next = await getOrgDocumentType(db, { organizationId, id: value.id });
      if (!next) {
        throw errors.badRequest("invalid_document_type", "Document type no longer exists");
      }
      const prev = doc.documentTypeId
        ? await getOrgDocumentType(db, { organizationId, id: doc.documentTypeId })
        : null;
      await updateDocument(db, {
        organizationId,
        id: documentId,
        documentTypeId: value.id,
      });
      changes.push({
        field: "documentType",
        oldValue: prev ? { id: prev.id, name: prev.name } : null,
        newValue: { id: next.id, name: next.name },
      });
    } else {
      const next = await getOrgStoragePath(db, { organizationId, id: value.id });
      if (!next) {
        throw errors.badRequest("invalid_storage_path", "Storage path no longer exists");
      }
      const prev = doc.storagePathId
        ? await getOrgStoragePath(db, { organizationId, id: doc.storagePathId })
        : null;
      await updateDocument(db, {
        organizationId,
        id: documentId,
        storagePathId: value.id,
      });
      changes.push({
        field: "storagePath",
        oldValue: prev ? { id: prev.id, name: prev.path } : null,
        newValue: { id: next.id, name: next.path },
      });
    }
  }

  if (field === "storagePath" && "value" in value) {
    const wanted = normalizeStoragePath(value.value);
    if (!isValidStoragePath(wanted)) {
      throw errors.badRequest("invalid_storage_path", "Proposed storage path is not valid");
    }
    // The path may have been created since the suggestion was made (another accept, manual add).
    const existing = (await getOrgStoragePaths(db, { organizationId })).find(
      (p) => p.path === wanted,
    );
    const next =
      existing ?? (await createStoragePath(db, { organizationId, path: wanted, aiEligible: true }));
    const prev = doc.storagePathId
      ? await getOrgStoragePath(db, { organizationId, id: doc.storagePathId })
      : null;
    await updateDocument(db, { organizationId, id: documentId, storagePathId: next.id });
    changes.push({
      field: "storagePath",
      oldValue: prev ? { id: prev.id, name: prev.path } : null,
      newValue: { id: next.id, name: next.path },
    });
  }

  if ((field === "title" || field === "documentDate") && "value" in value) {
    await updateDocument(db, {
      organizationId,
      id: documentId,
      ...(field === "title" ? { title: value.value } : { documentDate: value.value }),
    });
    changes.push(
      field === "title"
        ? {
            field: "title",
            oldValue: { value: doc.title },
            newValue: { value: value.value },
          }
        : {
            field: "documentDate",
            oldValue: doc.documentDate ? { value: doc.documentDate } : null,
            newValue: value.value ? { value: value.value } : null,
          },
    );
  }

  if (field === "tags" && "existingIds" in value) {
    const currentIds = new Set(
      (await getTagsByDocumentIds(db, { documentIds: [documentId] })).map((t) => t.id),
    );
    const owned = value.existingIds.length
      ? await getOrgTagsByIds(db, { organizationId, ids: value.existingIds })
      : [];
    for (const tag of owned) {
      await addDocumentTag(db, { documentId, tagId: tag.id });
      if (!currentIds.has(tag.id)) {
        changes.push({ field: "tags", newValue: { id: tag.id, name: tag.name } });
      }
    }
    for (const name of value.newNames) {
      const tag = await createTag(db, { organizationId, name });
      await addDocumentTag(db, { documentId, tagId: tag.id });
      changes.push({ field: "tags", newValue: { id: tag.id, name: tag.name } });
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
    } else if ("newOptionLabel" in value) {
      // The option may have been created since the suggestion was made (another accept, manual add).
      const existing = found.options.find(
        (o) => o.label.toLowerCase() === value.newOptionLabel.toLowerCase(),
      );
      const option =
        existing ?? (await addPropertyOption(db, { definitionId, label: value.newOptionLabel }));
      columns = customPropertyRegistry.select.toDb(option.id);
    } else if ("value" in value) {
      columns = coerceCustomValue(found.definition.type, found.options, value.value);
    }
    if (columns) {
      const prevRow = (await getDocumentPropertyValues(db, { documentId })).find(
        (row) => row.definitionId === definitionId,
      );
      // newOptionLabel may have added an option above.
      const refreshed = await getOrgPropertyDefinition(db, { organizationId, id: definitionId });
      const options = refreshed?.options ?? found.options;
      await setDocumentPropertyValue(db, { documentId, definitionId, values: columns });
      changes.push({
        field: "customProperty",
        customPropertyDefinitionId: definitionId,
        oldValue: propertyChangeSnapshot(found.definition.type, options, prevRow),
        newValue: propertyChangeSnapshot(found.definition.type, options, columns),
      });
    }
  }

  if (changes.length > 0) {
    await recordFieldChanges(db, { documentId, source: "human", createdBy: userId, changes });
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
    try {
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
    } catch (err) {
      if (err instanceof PasswordProtectedPdfError) {
        throw errors.badRequest(
          "pdf_password_protected",
          "This PDF is password protected. Remove the password and upload it again.",
        );
      }

      throw err;
    }
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
  .get("/ids", zValidator("query", listDocumentsQuerySchema), async (c) => {
    const organizationId = c.get("organizationId");
    const { q, filters, sort } = c.req.valid("query");
    const customPropertyTypes =
      filters && Object.keys(filters).some((key) => key.startsWith("cp:"))
        ? new Map(
            (await getOrgCustomPropertyTypes(db, { organizationId })).map(
              (d) => [d.id, d.type] as const,
            ),
          )
        : undefined;
    const ids = await getDocumentIds(db, {
      organizationId,
      query: q,
      filters,
      sort,
      customPropertyTypes,
    });
    return c.json({ ids });
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
    return new Response(createDocumentsZipStream({ driver, docs }), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="documents.zip"',
      },
    });
  })
  .post(
    "/delete",
    requireOrgPermission({ documents: ["delete"] }),
    zValidator("json", deleteDocumentsSchema),
    async (c) => {
      const organizationId = c.get("organizationId");
      const { documents: ids } = c.req.valid("json");
      const docs = await getOrgDocumentStorageKeys(db, { organizationId, ids });

      if (docs.length === 0) {
        throw errors.notFound("No documents found");
      }

      const driver = await getStorageDriver();

      // Objects first, rows second: a failed object delete leaves the row pointing at it so the
      // document is still listed and can be retried, whereas the reverse orphans bytes silently.
      if (driver) {
        for (const doc of docs) {
          await driver.deleteObject({ key: doc.storageKey });
          await driver.deleteObject({ key: `${doc.storageKey}.thumb.png` });
        }
      }

      await deleteDocuments(db, { organizationId, ids: docs.map((doc) => doc.id) });

      return c.json({ deleted: docs.length });
    },
  )
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
      let newType = null;
      if (values.documentTypeId) {
        newType = await getOrgDocumentType(db, { organizationId, id: values.documentTypeId });
        if (!newType) {
          throw errors.badRequest(
            "invalid_document_type",
            "Document type does not belong to this organization",
          );
        }
      }
      let newPath = null;
      if (values.storagePathId) {
        newPath = await getOrgStoragePath(db, { organizationId, id: values.storagePathId });
        if (!newPath) {
          throw errors.badRequest(
            "invalid_storage_path",
            "Storage path does not belong to this organization",
          );
        }
      }
      const userId = c.get("user")?.id ?? null;
      const changes: FieldChangeInput[] = [];
      if (values.title !== undefined) {
        changes.push({
          field: "title",
          oldValue: { value: doc.title },
          newValue: { value: values.title.trim() },
        });
      }
      if (values.documentDate !== undefined) {
        changes.push({
          field: "documentDate",
          oldValue: doc.documentDate ? { value: doc.documentDate } : null,
          newValue: values.documentDate ? { value: values.documentDate } : null,
        });
      }
      if (values.documentTypeId !== undefined) {
        const prevType = doc.documentTypeId
          ? await getOrgDocumentType(db, { organizationId, id: doc.documentTypeId })
          : null;
        changes.push({
          field: "documentType",
          oldValue: prevType ? { id: prevType.id, name: prevType.name } : null,
          newValue: newType ? { id: newType.id, name: newType.name } : null,
        });
      }
      if (values.storagePathId !== undefined) {
        const prevPath = doc.storagePathId
          ? await getOrgStoragePath(db, { organizationId, id: doc.storagePathId })
          : null;
        changes.push({
          field: "storagePath",
          oldValue: prevPath ? { id: prevPath.id, name: prevPath.path } : null,
          newValue: newPath ? { id: newPath.id, name: newPath.path } : null,
        });
      }
      await updateDocument(db, { organizationId, id, ...values });
      await recordFieldChanges(db, { documentId: id, source: "human", createdBy: userId, changes });
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
          await dismissSuggestionsForField(db, { documentId: id, field, resolvedBy: userId });
        }
      }
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
        doc,
        suggestion.field,
        suggestion.suggestedValue,
        suggestion.customPropertyDefinitionId,
        c.get("user")?.id ?? null,
      );
      await setSuggestionStatus(db, {
        id: suggestionId,
        documentId,
        status: "accepted",
        resolvedBy: c.get("user")?.id ?? null,
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
        resolvedBy: c.get("user")?.id ?? null,
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
        await recordFieldChanges(db, {
          documentId,
          source: "human",
          createdBy: c.get("user")?.id ?? null,
          changes: [
            ...addedTags.map(
              (t): FieldChangeInput => ({ field: "tags", newValue: { id: t.id, name: t.name } }),
            ),
            ...removedTags.map(
              (t): FieldChangeInput => ({
                field: "tags",
                oldValue: { id: t.id, name: t.name },
              }),
            ),
          ],
        });
      }
      await dismissSuggestionsForField(db, {
        documentId,
        field: "tags",
        resolvedBy: c.get("user")?.id ?? null,
      });
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
      const columns = definition.toDb(parsed.data);
      const prevRow = (await getDocumentPropertyValues(db, { documentId })).find(
        (row) => row.definitionId === definitionId,
      );
      await setDocumentPropertyValue(db, { documentId, definitionId, values: columns });
      await recordFieldChanges(db, {
        documentId,
        source: "human",
        createdBy: c.get("user")?.id ?? null,
        changes: [
          {
            field: "customProperty",
            customPropertyDefinitionId: definitionId,
            oldValue: propertyChangeSnapshot(found.definition.type, found.options, prevRow),
            newValue: propertyChangeSnapshot(found.definition.type, found.options, columns),
          },
        ],
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
      const found = await getOrgPropertyDefinition(db, { organizationId, id: definitionId });
      const prevRow = (await getDocumentPropertyValues(db, { documentId })).find(
        (row) => row.definitionId === definitionId,
      );
      await clearDocumentPropertyValue(db, { documentId, definitionId });
      if (found && prevRow) {
        await recordFieldChanges(db, {
          documentId,
          source: "human",
          createdBy: c.get("user")?.id ?? null,
          changes: [
            {
              field: "customProperty",
              customPropertyDefinitionId: definitionId,
              oldValue: propertyChangeSnapshot(found.definition.type, found.options, prevRow),
              newValue: null,
            },
          ],
        });
      }
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
