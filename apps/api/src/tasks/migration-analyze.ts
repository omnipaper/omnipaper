import { db } from "@omnipaper/database/client";
import { getMigrationById, updateMigration } from "@omnipaper/database/queries/migrations";
import { getSourceAdapter } from "@omnipaper/migration/adapters";
import { defineTask } from "@omnipaper/queue/worker";
import { getStorageDriver } from "../lib/storage";
import { withMigrationArchive } from "../migration/archive";

export const migrationAnalyzeTask = defineTask("migration-analyze", async ({ migrationId }) => {
  const migration = await getMigrationById(db, { id: migrationId });
  if (!migration) {
    return;
  }

  try {
    const driver = await getStorageDriver();
    if (!driver) {
      throw new Error("Storage is not configured");
    }

    const adapter = getSourceAdapter(migration.source);
    const preview = await withMigrationArchive(driver, migration.uploadKey, (zip) =>
      adapter.analyze(zip),
    );

    await updateMigration(db, {
      id: migrationId,
      status: "awaiting_confirmation",
      preview,
      docsTotal: preview.counts.documents,
    });
  } catch (err) {
    // Record the failure on the row and swallow — re-running is an explicit user action, not a
    // graphile auto-retry that would re-download a multi-GB archive 25 times (cf. ocr-extract).
    await updateMigration(db, {
      id: migrationId,
      status: "failed",
      error: err instanceof Error ? err.message : "Analysis failed",
    });
  }
});
