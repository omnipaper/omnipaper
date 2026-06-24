import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { documentsTags, tags } from "../schema";


export type GetOrgTagsParams = {
  organizationId: string;
};

export type GetOrgTagParams = {
  organizationId: string;
  id: string;
};

export type GetOrgTagsByIdsParams = {
  organizationId: string;
  ids: string[];
};

export type CreateTagInput = {
  organizationId: string;
  name: string;
  color?: string;
  description?: string;
};

export type UpdateTagInput = {
  organizationId: string;
  id: string;
  name?: string;
  color?: string;
  description?: string | null;
};

export type GetTagsByDocumentIdsParams = {
  documentIds: string[];
};

export type SetDocumentTagsParams = {
  documentId: string;
  tagIds: string[];
};

export type DocumentTagParams = {
  documentId: string;
  tagId: string;
};


const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
] as const;

function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] ?? TAG_COLORS[0];
}

export async function getOrgTags(db: Database, params: GetOrgTagsParams) {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      description: tags.description,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      documentCount: count(documentsTags.documentId),
    })
    .from(tags)
    .leftJoin(documentsTags, eq(documentsTags.tagId, tags.id))
    .where(eq(tags.organizationId, params.organizationId))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
}

export async function getOrgTag(db: Database, params: GetOrgTagParams) {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, params.id), eq(tags.organizationId, params.organizationId)))
    .limit(1);
  return tag;
}

export async function getOrgTagsByIds(db: Database, params: GetOrgTagsByIdsParams) {
  if (params.ids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, params.organizationId), inArray(tags.id, params.ids)));
}

export async function createTag(db: Database, input: CreateTagInput) {
  const [tag] = await db
    .insert(tags)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      color: input.color ?? randomTagColor(),
      description: input.description,
    })
    .returning();

  if (!tag) {
    throw new Error("Failed to create tag");
  }

  return tag;
}

export async function updateTag(db: Database, input: UpdateTagInput) {
  const patch: { name?: string; color?: string; description?: string | null } = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.color !== undefined) {
    patch.color = input.color;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgTag(db, { organizationId: input.organizationId, id: input.id });
  }

  const [tag] = await db
    .update(tags)
    .set(patch)
    .where(and(eq(tags.id, input.id), eq(tags.organizationId, input.organizationId)))
    .returning();

  return tag;
}

export async function deleteTag(
  db: Database,
  params: { organizationId: string; id: string }
) {
  await db
    .delete(tags)
    .where(and(eq(tags.id, params.id), eq(tags.organizationId, params.organizationId)));
}

export async function getTagsByDocumentIds(db: Database, params: GetTagsByDocumentIdsParams) {
  if (params.documentIds.length === 0) {
    return [];
  }

  return db
    .select({
      documentId: documentsTags.documentId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(documentsTags)
    .innerJoin(tags, eq(documentsTags.tagId, tags.id))
    .where(inArray(documentsTags.documentId, params.documentIds))
    .orderBy(asc(tags.name));
}

export async function setDocumentTags(db: Database, params: SetDocumentTagsParams) {
  const tagIds = [...new Set(params.tagIds)];

  await db.transaction(async (tx) => {
    await tx.delete(documentsTags).where(eq(documentsTags.documentId, params.documentId));
    if (tagIds.length > 0) {
      await tx
        .insert(documentsTags)
        .values(tagIds.map((tagId) => ({ documentId: params.documentId, tagId })));
    }
  });
}

export async function addDocumentTag(db: Database, params: DocumentTagParams) {
  await db
    .insert(documentsTags)
    .values({ documentId: params.documentId, tagId: params.tagId })
    .onConflictDoNothing();
}

export async function removeDocumentTag(db: Database, params: DocumentTagParams) {
  await db
    .delete(documentsTags)
    .where(
      and(eq(documentsTags.documentId, params.documentId), eq(documentsTags.tagId, params.tagId)),
    );
}
