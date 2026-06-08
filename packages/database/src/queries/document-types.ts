import { and, asc, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import { documents, documentTypes } from "../schema";

// Data access for the `document_types` taxonomy. Mirrors the tags queries: db-first so it works
// from a route, worker, or test, and can be handed a transaction.

export type GetOrgDocumentTypesParams = {
  organizationId: string;
};

export async function getOrgDocumentTypes(db: Database, params: GetOrgDocumentTypesParams) {
  return db
    .select({
      id: documentTypes.id,
      name: documentTypes.name,
      description: documentTypes.description,
      createdAt: documentTypes.createdAt,
      updatedAt: documentTypes.updatedAt,
      documentCount: count(documents.id),
    })
    .from(documentTypes)
    .leftJoin(documents, eq(documents.documentTypeId, documentTypes.id))
    .where(eq(documentTypes.organizationId, params.organizationId))
    .groupBy(documentTypes.id)
    .orderBy(asc(documentTypes.name));
}

export type GetOrgDocumentTypeParams = {
  organizationId: string;
  id: string;
};

// Single type scoped to its org — so one tenant can't read another's by id.
export async function getOrgDocumentType(db: Database, params: GetOrgDocumentTypeParams) {
  const [documentType] = await db
    .select()
    .from(documentTypes)
    .where(
      and(eq(documentTypes.id, params.id), eq(documentTypes.organizationId, params.organizationId)),
    )
    .limit(1);

  return documentType;
}

export type CreateDocumentTypeInput = {
  organizationId: string;
  name: string;
  description?: string;
};

export async function createDocumentType(db: Database, input: CreateDocumentTypeInput) {
  const [documentType] = await db
    .insert(documentTypes)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description,
    })
    .returning();

  if (!documentType) {
    throw new Error("Failed to create document type");
  }

  return documentType;
}

export type UpdateDocumentTypeInput = {
  organizationId: string;
  id: string;
  name?: string;
  description?: string | null;
};

// Patch scoped to the org. Only provided fields are written; an empty patch returns the current
// row so the route never issues an invalid empty UPDATE.
export async function updateDocumentType(db: Database, input: UpdateDocumentTypeInput) {
  const patch: { name?: string; description?: string | null } = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgDocumentType(db, { organizationId: input.organizationId, id: input.id });
  }

  const [documentType] = await db
    .update(documentTypes)
    .set(patch)
    .where(
      and(eq(documentTypes.id, input.id), eq(documentTypes.organizationId, input.organizationId)),
    )
    .returning();

  return documentType;
}

// Delete scoped to its org. documents.document_type_id is ON DELETE SET NULL, so assigned
// documents are simply un-typed, never removed.
export async function deleteDocumentType(
  db: Database,
  params: { organizationId: string; id: string },
) {
  await db
    .delete(documentTypes)
    .where(
      and(eq(documentTypes.id, params.id), eq(documentTypes.organizationId, params.organizationId)),
    );
}
