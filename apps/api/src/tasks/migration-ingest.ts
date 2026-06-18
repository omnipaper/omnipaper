import { db } from "@omnipaper/database/client";
import { getMigrationById, updateMigration } from "@omnipaper/database/queries/migrations";
import { getSourceAdapter } from "@omnipaper/migration/adapters";
import { defineTask } from "@omnipaper/queue/worker";
import { getStorageDriver } from "../lib/storage";
import { withMigrationArchive } from "../migration/archive";
import { runMigration } from "../migration/engine";

export const migrationIngestTask = defineTask("migration-ingest", async ({ migrationId }) => {
  const migration = await getMigrationById(db, { id: migrationId });
  if (!migration) {
    return;
  }

  try {
    const driver = await getStorageDriver();
    if (!driver) {
      throw new Error("Storage is not configured");
    }
    if (!migration.createdBy) {
      throw new Error("The user who started this migration no longer exists");
    }

    const adapter = getSourceAdapter(migration.source);
    const createdBy = migration.createdBy;

    const report = await withMigrationArchive(driver, migration.uploadKey, async (zip) => {
      const ir = await adapter.buildIntermediate(zip);
      return runMigration({
        db,
        driver,
        zip,
        ir,
        organizationId: migration.organizationId,
        createdBy,
        options: migration.options,
        onProgress: async (progress) => {
          await updateMigration(db, {
            id: migrationId,
            docsImported: progress.imported,
            docsDuplicate: progress.duplicate,
            docsFailed: progress.failed,
          });
        },
      });
    });

    await updateMigration(db, { id: migrationId, status: "done", report });

    // The staged export embeds source secrets — purge it from storage now that the import is done.
    await driver.deleteObject({ key: migration.uploadKey });
  } catch (err) {
    await updateMigration(db, {
      id: migrationId,
      status: "failed",
      error: err instanceof Error ? err.message : "Import failed",
    });
  }
});
