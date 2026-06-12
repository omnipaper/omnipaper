import { db } from "@omnipaper/database/client";
import { getMigrationById, updateMigration } from "@omnipaper/database/queries/migrations";
import { getSourceAdapter } from "@omnipaper/migration/adapters";
import { defineTask } from "@omnipaper/queue/worker";
import { getStorageDriver } from "../lib/storage";
import { withMigrationArchive } from "../migration/archive";
import { runMigration } from "../migration/engine";

// INGEST phase (after the user confirms): build the IR and import every document through the funnel,
// updating progress counters as it goes. Per-document errors are isolated; the staged export — which
// embeds source secrets like mail credentials — is deleted once the import completes.
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
      // Documents are attributed to the initiating user; if that account was deleted mid-run there's
      // no one to own the imports, so stop rather than guess.
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
