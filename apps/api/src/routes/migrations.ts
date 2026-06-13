import { zValidator } from "@hono/zod-validator";
import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  createMigration,
  deleteMigration,
  getActiveMigrationForOrg,
  getOrgMigration,
  listOrgMigrations,
  updateMigration,
} from "@omnipaper/database/queries/migrations";
import { listSourceAdapterNames } from "@omnipaper/migration/adapters";
import { enqueue } from "@omnipaper/queue/producer";
import { Hono } from "hono";
import { z } from "zod";
import type { Variables } from "../context";
import { errors } from "../errors";
import { getStorageDriver } from "../lib/storage";
import { requireOrgPermission } from "../middleware";
import { toMigrationDto } from "../serializers/migration";

const PART_SIZE = 64 * 1024 * 1024;

const createMigrationSchema = z.object({ source: z.string().min(1) });
const signPartSchema = z.object({ partNumber: z.number().int().min(1).max(10_000) });
const completeUploadSchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1) }))
    .min(1),
});
const confirmSchema = z.object({
  importOcr: z.boolean().optional(),
  timezone: z.string().optional(),
});

export const migrationsRoutes = new Hono<{ Variables: Variables }>()
  .use("*", requireOrgPermission({ migrations: ["manage"] }))
  .get("/", async (c) => {
    const organizationId = c.get("organizationId");
    const rows = await listOrgMigrations(db, { organizationId });
    return c.json({ migrations: rows.map(toMigrationDto) });
  })
  .post("/", zValidator("json", createMigrationSchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      throw errors.unauthorized();
    }
    const organizationId = c.get("organizationId");
    const { source } = c.req.valid("json");

    if (!listSourceAdapterNames().includes(source)) {
      throw errors.badRequest("invalid_source", `Unknown migration source: ${source}`);
    }

    const active = await getActiveMigrationForOrg(db, { organizationId });
    if (active) {
      throw errors.badRequest(
        "migration_in_progress",
        "A migration is already in progress for this organization",
      );
    }

    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }

    const id = createId("mig");
    const uploadKey = `${organizationId}/migrations/${id}/export.zip`;
    const { uploadId } = await driver.createMultipartUpload({
      key: uploadKey,
      contentType: "application/zip",
    });

    const migration = await createMigration(db, {
      id,
      organizationId,
      createdBy: user.id,
      source,
      uploadKey,
      uploadId,
    });

    return c.json({ migrationId: migration.id, partSize: PART_SIZE });
  })
  .post("/:id/parts", zValidator("json", signPartSchema), async (c) => {
    const organizationId = c.get("organizationId");
    const migration = await getOrgMigration(db, { organizationId, id: c.req.param("id") });
    if (!migration) {
      throw errors.notFound("Migration not found");
    }
    if (!migration.uploadId) {
      throw errors.badRequest("upload_not_active", "This migration's upload is not in progress");
    }

    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }

    const { url } = await driver.signUploadPart({
      key: migration.uploadKey,
      uploadId: migration.uploadId,
      partNumber: c.req.valid("json").partNumber,
    });

    return c.json({ url });
  })
  .post("/:id/complete-upload", zValidator("json", completeUploadSchema), async (c) => {
    const organizationId = c.get("organizationId");
    const migration = await getOrgMigration(db, { organizationId, id: c.req.param("id") });
    if (!migration) {
      throw errors.notFound("Migration not found");
    }
    if (!migration.uploadId) {
      throw errors.badRequest("upload_not_active", "This migration's upload is not in progress");
    }

    const driver = await getStorageDriver();
    if (!driver) {
      throw errors.badRequest("storage_not_configured", "Storage is not configured");
    }

    await driver.completeMultipartUpload({
      key: migration.uploadKey,
      uploadId: migration.uploadId,
      parts: c.req.valid("json").parts,
    });

    await updateMigration(db, { id: migration.id, status: "analyzing", uploadId: null });
    await enqueue("migration-analyze", { migrationId: migration.id });

    return c.json({ ok: true });
  })
  .get("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const migration = await getOrgMigration(db, { organizationId, id: c.req.param("id") });
    if (!migration) {
      throw errors.notFound("Migration not found");
    }
    return c.json({ migration: toMigrationDto(migration) });
  })
  .post("/:id/confirm", zValidator("json", confirmSchema), async (c) => {
    const organizationId = c.get("organizationId");
    const migration = await getOrgMigration(db, { organizationId, id: c.req.param("id") });
    if (!migration) {
      throw errors.notFound("Migration not found");
    }
    if (migration.status !== "awaiting_confirmation") {
      throw errors.badRequest(
        "not_awaiting_confirmation",
        "This migration is not awaiting confirmation",
      );
    }

    const { importOcr, timezone } = c.req.valid("json");
    await updateMigration(db, {
      id: migration.id,
      status: "importing",
      options: { importOcr: importOcr ?? true, timezone },
    });
    await enqueue("migration-ingest", { migrationId: migration.id });

    return c.json({ ok: true });
  })
  .delete("/:id", async (c) => {
    const organizationId = c.get("organizationId");
    const migration = await getOrgMigration(db, { organizationId, id: c.req.param("id") });
    if (!migration) {
      throw errors.notFound("Migration not found");
    }
    if (migration.status === "importing") {
      throw errors.badRequest(
        "import_in_progress",
        "Can't cancel a migration while it's importing",
      );
    }

    const driver = await getStorageDriver();
    if (driver) {
      if (migration.uploadId) {
        await driver
          .abortMultipartUpload({ key: migration.uploadKey, uploadId: migration.uploadId })
          .catch(() => undefined);
      } else {
        await driver.deleteObject({ key: migration.uploadKey }).catch(() => undefined);
      }
    }

    await deleteMigration(db, { organizationId, id: migration.id });
    return c.json({ ok: true });
  });
