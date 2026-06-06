import { and, desc, eq, sql } from "drizzle-orm";
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
};

// List (or full-text search) an org's documents. Returns the list-item shape — not the full row.
export async function getDocuments(db: Database, params: GetDocumentsParams) {
  const { organizationId } = params;
  const q = params.query?.trim();

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
    .where(eq(documents.organizationId, organizationId))
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

export type CreateDocumentInput = {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
};

export async function createDocument(db: Database, input: CreateDocumentInput) {
  await db.transaction(async (tx) => {
    await tx.insert(documents).values({
      id: input.id,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      title: input.title,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    await recordEvent(tx, {
      organizationId: input.organizationId,
      resource: { type: "document", id: input.id, label: input.title },
      event: "document.created",
      actor: { type: "user", id: input.createdBy },
    });
  });
}

export async function deleteDocument(db: Database, params: { id: string }) {
  await db.delete(documents).where(eq(documents.id, params.id));
}

export async function markDocumentOcrProcessing(db: Database, params: { id: string }) {
  await db.update(documents).set({ ocrStatus: "processing" }).where(eq(documents.id, params.id));
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
