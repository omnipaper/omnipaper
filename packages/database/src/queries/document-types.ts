import { and, asc, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import { documents, documentTypes } from "../schema";

export type GetOrgDocumentTypesParams = {
  organizationId: string;
};

export type GetOrgDocumentTypeParams = {
  organizationId: string;
  id: string;
};

export type CreateDocumentTypeInput = {
  organizationId: string;
  name: string;
  description?: string;
  aiEligible?: boolean;
};

export type UpdateDocumentTypeInput = {
  organizationId: string;
  id: string;
  name?: string;
  description?: string | null;
  aiEligible?: boolean;
};

export type DeleteDocumentTypeParams = {
  organizationId: string;
  id: string;
};

export async function getOrgDocumentTypes(db: Database, params: GetOrgDocumentTypesParams) {
  return db
    .select({
      id: documentTypes.id,
      name: documentTypes.name,
      description: documentTypes.description,
      aiEligible: documentTypes.aiEligible,
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

export async function createDocumentType(db: Database, input: CreateDocumentTypeInput) {
  const [documentType] = await db
    .insert(documentTypes)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description,
      aiEligible: input.aiEligible,
    })
    .returning();

  if (!documentType) {
    throw new Error("Failed to create document type");
  }

  return documentType;
}

export async function updateDocumentType(db: Database, input: UpdateDocumentTypeInput) {
  const patch: { name?: string; description?: string | null; aiEligible?: boolean } = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.aiEligible !== undefined) {
    patch.aiEligible = input.aiEligible;
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

export async function deleteDocumentType(db: Database, params: DeleteDocumentTypeParams) {
  await db
    .delete(documentTypes)
    .where(
      and(eq(documentTypes.id, params.id), eq(documentTypes.organizationId, params.organizationId)),
    );
}
