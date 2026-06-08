import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { documentsTags, tags } from "../schema";

// All data access for the `tags` domain. Like the documents queries, every function takes `db`
// first so it works from an HTTP route, a worker, or a test, and can be handed a transaction.

export type GetOrgTagsParams = {
  organizationId: string;
};

// List an org's tags with how many documents each is attached to. leftJoin keeps unused tags
// (count 0); GROUP BY the PK lets Postgres select the other tag columns without aggregating them.
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

export type GetOrgTagParams = {
  organizationId: string;
  id: string;
};

// Single tag scoped to its org — the safe default, so one tenant can't read another's tag by id.
export async function getOrgTag(db: Database, params: GetOrgTagParams) {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, params.id), eq(tags.organizationId, params.organizationId)))
    .limit(1);

  return tag;
}

export type GetOrgTagsByIdsParams = {
  organizationId: string;
  ids: string[];
};

// Resolve a set of tag ids within an org — used to validate that ids a caller wants to attach to
// a document actually belong to that org before writing them.
export async function getOrgTagsByIds(db: Database, params: GetOrgTagsByIdsParams) {
  if (params.ids.length === 0) {
    return [];
  }

  return db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, params.organizationId), inArray(tags.id, params.ids)));
}

export type CreateTagInput = {
  organizationId: string;
  name: string;
  color?: string;
  description?: string;
};

// New tags get a random hue from this palette instead of all defaulting to the same grey. Stored
// as plain hex; the UI renders any hex as the tag's colour dot.
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

// Insert a tag. Name is trimmed here so the unique(organizationId, name) constraint sees the same
// value the picker will. An absent `color` gets a random palette colour, not the grey column default.
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

export type UpdateTagInput = {
  organizationId: string;
  id: string;
  name?: string;
  color?: string;
  description?: string | null;
};

// Patch a tag scoped to its org. Only provided fields are written; an empty patch is a no-op that
// returns the current row, so the route never issues an invalid empty UPDATE.
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

// Delete a tag scoped to its org. The documents_tags FK cascades, so attachments go with it.
export async function deleteTag(db: Database, params: { organizationId: string; id: string }) {
  await db
    .delete(tags)
    .where(and(eq(tags.id, params.id), eq(tags.organizationId, params.organizationId)));
}

export type GetTagsByDocumentIdsParams = {
  documentIds: string[];
};

// Batch-fetch the tags attached to many documents in one query (avoids N+1 when enriching a list).
// Returns flat rows carrying documentId so the caller can group them per document.
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

export type SetDocumentTagsParams = {
  documentId: string;
  tagIds: string[];
};

// Replace a document's whole tag set in one transaction (delete-all then insert). The caller is
// responsible for verifying the document and the tags belong to the org before calling this.
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
