import type { Migration } from "@omnipaper/database/schema";

export function toMigrationDto(migration: Migration) {
  return {
    id: migration.id,
    source: migration.source,
    status: migration.status,
    docsTotal: migration.docsTotal,
    docsImported: migration.docsImported,
    docsDuplicate: migration.docsDuplicate,
    docsFailed: migration.docsFailed,
    preview: migration.preview,
    report: migration.report,
    error: migration.error,
    createdAt: migration.createdAt,
    updatedAt: migration.updatedAt,
  };
}
