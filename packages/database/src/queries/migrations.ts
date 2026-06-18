import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { type Migration, type MigrationOptions, migrations } from "../schema";

export type MigrationStatus = Migration["status"];

export type CreateMigrationInput = {
  id: string;
  organizationId: string;
  createdBy: string;
  source: string;
  uploadKey: string;
  uploadId?: string;
};

export async function createMigration(db: Database, input: CreateMigrationInput) {
  const [row] = await db
    .insert(migrations)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      source: input.source,
      uploadKey: input.uploadKey,
      uploadId: input.uploadId,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create migration");
  }

  return row;
}

export async function getOrgMigration(
  db: Database,
  params: { organizationId: string; id: string },
) {
  const [row] = await db
    .select()
    .from(migrations)
    .where(and(eq(migrations.id, params.id), eq(migrations.organizationId, params.organizationId)))
    .limit(1);

  return row;
}

export async function getMigrationById(db: Database, params: { id: string }) {
  const [row] = await db.select().from(migrations).where(eq(migrations.id, params.id)).limit(1);

  return row;
}

const ACTIVE_STATUSES = [
  "created",
  "analyzing",
  "awaiting_confirmation",
  "importing",
] as const satisfies MigrationStatus[];

export async function getActiveMigrationForOrg(db: Database, params: { organizationId: string }) {
  const [row] = await db
    .select()
    .from(migrations)
    .where(
      and(
        eq(migrations.organizationId, params.organizationId),
        inArray(migrations.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);

  return row;
}

export async function listOrgMigrations(db: Database, params: { organizationId: string }) {
  return db
    .select()
    .from(migrations)
    .where(eq(migrations.organizationId, params.organizationId))
    .orderBy(desc(migrations.createdAt));
}

export async function deleteMigration(
  db: Database,
  params: { organizationId: string; id: string },
) {
  await db
    .delete(migrations)
    .where(and(eq(migrations.id, params.id), eq(migrations.organizationId, params.organizationId)));
}

export type UpdateMigrationInput = {
  id: string;
  status?: MigrationStatus;
  uploadId?: string | null;
  options?: MigrationOptions;
  preview?: unknown;
  report?: unknown;
  docsTotal?: number;
  docsImported?: number;
  docsDuplicate?: number;
  docsFailed?: number;
  checkpoint?: unknown;
  error?: string | null;
};

export async function updateMigration(db: Database, input: UpdateMigrationInput) {
  const patch: Partial<typeof migrations.$inferInsert> = {};

  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.uploadId !== undefined) {
    patch.uploadId = input.uploadId;
  }
  if (input.options !== undefined) {
    patch.options = input.options;
  }
  if (input.preview !== undefined) {
    patch.preview = input.preview;
  }
  if (input.report !== undefined) {
    patch.report = input.report;
  }
  if (input.docsTotal !== undefined) {
    patch.docsTotal = input.docsTotal;
  }
  if (input.docsImported !== undefined) {
    patch.docsImported = input.docsImported;
  }
  if (input.docsDuplicate !== undefined) {
    patch.docsDuplicate = input.docsDuplicate;
  }
  if (input.docsFailed !== undefined) {
    patch.docsFailed = input.docsFailed;
  }
  if (input.checkpoint !== undefined) {
    patch.checkpoint = input.checkpoint;
  }
  if (input.error !== undefined) {
    patch.error = input.error;
  }

  const [row] = await db
    .update(migrations)
    .set(patch)
    .where(eq(migrations.id, input.id))
    .returning();

  return row;
}
