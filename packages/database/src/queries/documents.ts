import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { recordEvent } from "../activity";
import { user as userTable } from "../auth-schema";
import type { Database } from "../client";
import { activityEvents, documents } from "../schema";

// All data access for the `documents` domain lives here. Functions take `db` as their first
// argument (mirroring recordEvent in ../activity), so the same query works from an HTTP route,
// the OCR worker, or a test — and so a caller can pass a transaction handle when needed.

export type GetDocumentsParams = {
  organizationId: string;
  query?: string;
  // Storage-path taxonomy filter for the folder views. `unfiled` (documents with no path) and
  // `storagePathId` (a specific path) are mutually exclusive; `unfiled` wins if both are set.
  storagePathId?: string;
  unfiled?: boolean;
};

// List (or full-text search) an org's documents. Returns the list-item shape — not the full row.
export async function getDocuments(db: Database, params: GetDocumentsParams) {
  const { organizationId, storagePathId, unfiled } = params;
  const q = params.query?.trim();

  // Optional path predicate, shared by both branches below. `and()` ignores an undefined member,
  // so when no path filter is requested this is a no-op.
  const pathFilter = unfiled
    ? isNull(documents.storagePathId)
    : storagePathId
      ? eq(documents.storagePathId, storagePathId)
      : undefined;

  if (q) {
    // Prefix search: websearch_to_tsquery parses the user syntax (quotes, OR, -), then we append
    // ':*' to the last lexeme so a partial word like "mat" matches "mateusz" (autocomplete-style).
    // nullif(...,'') guards empty input — a bare ':*' would be a tsquery syntax error.
    const tsQuery = sql`to_tsquery('simple', nullif(websearch_to_tsquery('simple', ${q})::text, '') || ':*')`;

    return db
      .select({
        id: documents.id,
        title: documents.title,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        ocrStatus: documents.ocrStatus,
        createdAt: documents.createdAt,
        snippet: sql<
          string | null
        >`ts_headline('simple', coalesce(${documents.ocrText}, ''), ${tsQuery}, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MinWords=5, MaxWords=18')`,
      })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, organizationId),
          sql`${documents.searchVector} @@ ${tsQuery}`,
          pathFilter,
        ),
      )
      .orderBy(sql`ts_rank(${documents.searchVector}, ${tsQuery}) desc`);
  }

  return db
    .select({
      id: documents.id,
      title: documents.title,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      ocrStatus: documents.ocrStatus,
      createdAt: documents.createdAt,
      snippet: sql<string | null>`null`,
    })
    .from(documents)
    .where(and(eq(documents.organizationId, organizationId), pathFilter))
    .orderBy(desc(documents.createdAt));
}

export type GetOrgDocumentParams = {
  organizationId: string;
  id: string;
};

// Fetch a single document scoped to its org. This is the safe default for request handlers —
// the org filter makes it impossible to read another tenant's document by id.
export async function getOrgDocument(db: Database, params: GetOrgDocumentParams) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, params.organizationId)))
    .limit(1);

  return doc;
}

// Fetch a document by primary key with NO org scope. Only for system contexts that legitimately
// have no org in hand — e.g. the OCR worker, which receives just a documentId off the queue.
export async function getDocumentById(db: Database, params: { id: string }) {
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
  params: { organizationId: string; sha256: string },
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
  // Optional metadata for non-upload sources (migration). `documentDate` is the document's own date;
  // `createdAt` overrides the system ingestion timestamp (e.g. Paperless `added`) — both default to
  // the row's own defaults (null / now) when omitted.
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

// Patch a document's editable metadata, scoped to its org. Only provided fields are written; an
// empty patch returns the current row so the route never issues an invalid empty UPDATE. A null
// for documentDate/documentTypeId/storagePathId clears that field.
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

// Overwrite a document's extracted text with a manual correction, scoped to its org. The generated
// search_vector column reindexes full-text search automatically — no extra step. Status is left
// as-is: it reflects the OCR pipeline state, which a manual edit doesn't change.
export async function updateDocumentOcrText(
  db: Database,
  params: { organizationId: string; id: string; ocrText: string },
) {
  const [doc] = await db
    .update(documents)
    .set({ ocrText: params.ocrText })
    .where(and(eq(documents.id, params.id), eq(documents.organizationId, params.organizationId)))
    .returning();

  return doc;
}

export async function deleteDocument(db: Database, params: { id: string }) {
  await db.delete(documents).where(eq(documents.id, params.id));
}

export async function markDocumentOcrProcessing(db: Database, params: { id: string }) {
  await db.update(documents).set({ ocrStatus: "processing" }).where(eq(documents.id, params.id));
}

export async function markDocumentOcrPending(db: Database, params: { id: string }) {
  await db.update(documents).set({ ocrStatus: "pending" }).where(eq(documents.id, params.id));
}

// Record an OCR failure so the document leaves "processing" (otherwise a thrown worker error would
// strand it there forever) and the UI can surface a re-run affordance against the "failed" status.
export async function markDocumentOcrFailed(db: Database, params: { id: string }) {
  await db.update(documents).set({ ocrStatus: "failed" }).where(eq(documents.id, params.id));
}

// Mark a document whose MIME type the active OCR engine can't read, so it settles immediately
// instead of churning a doomed extraction. Unlike "failed" there's nothing to retry — the UI hides
// the re-run affordance until the configured engine gains support for the type.
export async function markDocumentOcrUnsupported(db: Database, params: { id: string }) {
  await db.update(documents).set({ ocrStatus: "unsupported" }).where(eq(documents.id, params.id));
}

export type CompleteDocumentOcrInput = {
  id: string;
  organizationId: string;
  title: string;
  text: string;
};

// Store the extracted text, flip status to completed, and record the event — atomically.
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
