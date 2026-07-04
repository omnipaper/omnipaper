import { and, asc, count, eq } from "drizzle-orm";
import type { Database } from "../client";
import { documents, storagePaths } from "../schema";

export type GetOrgStoragePathsParams = {
  organizationId: string;
};

export type GetOrgStoragePathParams = {
  organizationId: string;
  id: string;
};

export type CreateStoragePathInput = {
  organizationId: string;
  path: string;
  description?: string;
  aiEligible?: boolean;
};

export type UpdateStoragePathInput = {
  organizationId: string;
  id: string;
  path?: string;
  description?: string | null;
  aiEligible?: boolean;
};

export type DeleteStoragePathParams = {
  organizationId: string;
  id: string;
};

export async function getOrgStoragePaths(db: Database, params: GetOrgStoragePathsParams) {
  return db
    .select({
      id: storagePaths.id,
      path: storagePaths.path,
      description: storagePaths.description,
      aiEligible: storagePaths.aiEligible,
      createdAt: storagePaths.createdAt,
      updatedAt: storagePaths.updatedAt,
      documentCount: count(documents.id),
    })
    .from(storagePaths)
    .leftJoin(documents, eq(documents.storagePathId, storagePaths.id))
    .where(eq(storagePaths.organizationId, params.organizationId))
    .groupBy(storagePaths.id)
    .orderBy(asc(storagePaths.path));
}

export async function getOrgStoragePath(db: Database, params: GetOrgStoragePathParams) {
  const [storagePath] = await db
    .select()
    .from(storagePaths)
    .where(
      and(eq(storagePaths.id, params.id), eq(storagePaths.organizationId, params.organizationId)),
    )
    .limit(1);

  return storagePath;
}

export async function createStoragePath(db: Database, input: CreateStoragePathInput) {
  const [storagePath] = await db
    .insert(storagePaths)
    .values({
      organizationId: input.organizationId,
      path: input.path.trim(),
      description: input.description,
      aiEligible: input.aiEligible,
    })
    .returning();

  if (!storagePath) {
    throw new Error("Failed to create storage path");
  }

  return storagePath;
}

export async function updateStoragePath(db: Database, input: UpdateStoragePathInput) {
  const patch: { path?: string; description?: string | null; aiEligible?: boolean } = {};

  if (input.path !== undefined) {
    patch.path = input.path.trim();
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.aiEligible !== undefined) {
    patch.aiEligible = input.aiEligible;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgStoragePath(db, { organizationId: input.organizationId, id: input.id });
  }

  const [storagePath] = await db
    .update(storagePaths)
    .set(patch)
    .where(
      and(eq(storagePaths.id, input.id), eq(storagePaths.organizationId, input.organizationId)),
    )
    .returning();

  return storagePath;
}

export async function deleteStoragePath(db: Database, params: DeleteStoragePathParams) {
  await db
    .delete(storagePaths)
    .where(
      and(eq(storagePaths.id, params.id), eq(storagePaths.organizationId, params.organizationId)),
    );
}
