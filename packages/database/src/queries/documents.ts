import type { FilterState, SortState } from "@omnipaper/shared/document-filters";
import { and, desc, eq, sql } from "drizzle-orm";
import { recordEvent } from "../activity";
import { user as userTable } from "../auth-schema";
import type { Database } from "../client";
import { activityEvents, documents, documentTypes, storagePaths } from "../schema";
import {
  buildDocumentOrderBy,
  buildDocumentWhere,
  type CustomPropertyTypeMap,
} from "./document-filters";
// One page of the document list. The list is fetched in batches of this size (offset pagination);
// the API turns the offset into an opaque cursor for the client.
export const DEFAULT_PAGE_SIZE = 40;
export type GetDocumentsParams = {
  organizationId: string;
  query?: string;
  filters?: FilterState;
  sort?: SortState;
  customPropertyTypes?: CustomPropertyTypeMap;
  // Page window. Defaults to the first page; callers (the list route) pass an explicit offset.
  limit?: number;
  offset?: number;
};
export async function getDocuments(db: Database, params: GetDocumentsParams) {
  const { organizationId, filters, sort, customPropertyTypes } = params;
  const q = params.query?.trim();
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;
  const offset = params.offset ?? 0;
  // Folder scope (storage path) is just another filter — see the `path` case in buildDocumentWhere.
  const filterConds = buildDocumentWhere(filters, customPropertyTypes);
  const explicitOrder = buildDocumentOrderBy(sort);
  const columns = {
    id: documents.id,
    title: documents.title,
    mimeType: documents.mimeType,
    sizeBytes: documents.sizeBytes,
    ocrStatus: documents.ocrStatus,
    thumbnailStatus: documents.thumbnailStatus,
    documentDate: documents.documentDate,
    documentTypeName: documentTypes.name,
    storagePathName: storagePaths.path,
    createdAt: documents.createdAt,
  };
  if (q) {
    const tsQuery = sql`to_tsquery('simple', nullif(websearch_to_tsquery('simple', ${q})::text, '') || ':*')`;
    return db
      .select({
        ...columns,
        snippet: sql<
          string | null
        >`ts_headline('simple', coalesce(${documents.ocrText}, ''), ${tsQuery}, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=18')`,
      })
      .from(documents)
      .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
      .leftJoin(storagePaths, eq(documents.storagePathId, storagePaths.id))
      .where(
        and(
          eq(documents.organizationId, organizationId),
          sql`${documents.searchVector} @@ ${tsQuery}`,
          ...filterConds,
        ),
      )
      .orderBy(
        ...(explicitOrder ?? [
          sql`ts_rank(${documents.searchVector}, ${tsQuery}) desc`,
          desc(documents.id),
        ]),
      )
      .limit(limit)
      .offset(offset);
  }
  return db
    .select({ ...columns, snippet: sql<string | null>`null` })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .leftJoin(storagePaths, eq(documents.storagePathId, storagePaths.id))
    .where(and(eq(documents.organizationId, organizationId), ...filterConds))
    .orderBy(...(explicitOrder ?? [desc(documents.createdAt), desc(documents.id)]))
    .limit(limit)
    .offset(offset);
}
export type GetOrgDocumentParams = {
  organizationId: string;
  id: string;
};
export async function getOrgDocument(db: Database, params: GetOrgDocumentParams) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, params.organizationId)))
    .limit(1);
  return doc;
}
export async function getDocumentById(
  db: Database,
  params: {
    id: string;
  },
) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, params.id)).limit(1);
  return doc;
}
export type GetDocumentActivityParams = {
  organizationId: string;
  documentId: string;
};
export async function getDocumentActivity(db: Database, params: GetDocumentActivityParams) {
  return db
    .select({
      id: activityEvents.id,
      event: activityEvents.event,
      actorType: activityEvents.actorType,
      resourceLabel: activityEvents.resourceLabel,
      data: activityEvents.data,
      createdAt: activityEvents.createdAt,
      user: { id: userTable.id, name: userTable.name },
    })
    .from(activityEvents)
    .leftJoin(userTable, eq(activityEvents.userId, userTable.id))
    .where(
      and(
        eq(activityEvents.organizationId, params.organizationId),
        eq(activityEvents.resourceType, "document"),
        eq(activityEvents.resourceId, params.documentId),
      ),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(50);
}
export async function getDocumentByHash(
  db: Database,
  params: {
    organizationId: string;
    sha256: string;
  },
) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.organizationId, params.organizationId), eq(documents.sha256, params.sha256)),
    )
    .limit(1);
  return doc;
}
export type CreateDocumentInput = {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  originalFilename?: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  documentDate?: string;
  createdAt?: Date;
};
export async function createDocument(db: Database, input: CreateDocumentInput) {
  await db.transaction(async (tx) => {
    await tx.insert(documents).values({
      id: input.id,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      title: input.title,
      originalFilename: input.originalFilename,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      documentDate: input.documentDate,
      createdAt: input.createdAt,
    });
    await recordEvent(tx, {
      organizationId: input.organizationId,
      resource: { type: "document", id: input.id, label: input.title },
      event: "document.created",
      actor: { type: "user", id: input.createdBy },
    });
  });
}
export type UpdateDocumentInput = {
  organizationId: string;
  id: string;
  title?: string;
  documentDate?: string | null;
  documentTypeId?: string | null;
  storagePathId?: string | null;
};
export async function updateDocument(db: Database, input: UpdateDocumentInput) {
  const patch: {
    title?: string;
    documentDate?: string | null;
    documentTypeId?: string | null;
    storagePathId?: string | null;
  } = {};
  if (input.title !== undefined) {
    patch.title = input.title.trim();
  }
  if (input.documentDate !== undefined) {
    patch.documentDate = input.documentDate;
  }
  if (input.documentTypeId !== undefined) {
    patch.documentTypeId = input.documentTypeId;
  }
  if (input.storagePathId !== undefined) {
    patch.storagePathId = input.storagePathId;
  }
  if (Object.keys(patch).length === 0) {
    return getOrgDocument(db, { organizationId: input.organizationId, id: input.id });
  }
  const [doc] = await db
    .update(documents)
    .set(patch)
    .where(and(eq(documents.id, input.id), eq(documents.organizationId, input.organizationId)))
    .returning();
  return doc;
}
export async function updateDocumentOcrText(
  db: Database,
  params: {
    organizationId: string;
    id: string;
    ocrText: string;
  },
) {
  const [doc] = await db
    .update(documents)
    .set({ ocrText: params.ocrText })
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, params.organizationId)))
    .returning();
  return doc;
}
export async function deleteDocument(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.delete(documents).where(eq(documents.id, params.id));
}
export async function markDocumentOcrProcessing(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.update(documents).set({ ocrStatus: "processing" }).where(eq(documents.id, params.id));
}
export async function markDocumentOcrPending(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.update(documents).set({ ocrStatus: "pending" }).where(eq(documents.id, params.id));
}
export async function markDocumentOcrFailed(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.update(documents).set({ ocrStatus: "failed" }).where(eq(documents.id, params.id));
}
export async function markDocumentOcrUnsupported(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.update(documents).set({ ocrStatus: "unsupported" }).where(eq(documents.id, params.id));
}
export type CompleteDocumentOcrInput = {
  id: string;
  organizationId: string;
  title: string;
  text: string;
};
export async function completeDocumentOcr(db: Database, input: CompleteDocumentOcrInput) {
  await db.transaction(async (tx) => {
    await tx
      .update(documents)
      .set({ ocrStatus: "completed", ocrText: input.text })
      .where(eq(documents.id, input.id));
    await recordEvent(tx, {
      organizationId: input.organizationId,
      resource: { type: "document", id: input.id, label: input.title },
      event: "document.ocr_completed",
      actor: { type: "system" },
      data: { characters: input.text.length },
    });
  });
}
export async function markDocumentThumbnailProcessing(
  db: Database,
  params: {
    id: string;
  },
) {
  await db
    .update(documents)
    .set({ thumbnailStatus: "processing" })
    .where(eq(documents.id, params.id));
}
export async function markDocumentThumbnailCompleted(
  db: Database,
  params: {
    id: string;
  },
) {
  await db
    .update(documents)
    .set({ thumbnailStatus: "completed" })
    .where(eq(documents.id, params.id));
}
export async function markDocumentThumbnailFailed(
  db: Database,
  params: {
    id: string;
  },
) {
  await db.update(documents).set({ thumbnailStatus: "failed" }).where(eq(documents.id, params.id));
}
export async function markDocumentThumbnailUnsupported(
  db: Database,
  params: {
    id: string;
  },
) {
  await db
    .update(documents)
    .set({ thumbnailStatus: "unsupported" })
    .where(eq(documents.id, params.id));
}
