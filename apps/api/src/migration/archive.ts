import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openZip, type ZipSource } from "@omnipaper/migration/zip";
import type { StorageDriver } from "@omnipaper/storage/driver";

// Both migration phases need the staged export on local disk: the ZIP central directory lives at the
// end of the file, so reading it needs random access (not an S3 stream). We pull it via a presigned
// GET to a temp file, open it, run the phase, and always clean the temp dir up afterwards. The staged
// object in S3 is deleted separately by the ingest phase once the import is done.
export async function withMigrationArchive<T>(
  driver: StorageDriver,
  uploadKey: string,
  fn: (zip: ZipSource) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "omnipaper-migration-"));
  const file = join(dir, "export.zip");

  try {
    const { url } = await driver.createDownloadUrl({ key: uploadKey, expiresInSeconds: 60 * 60 });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download migration archive (HTTP ${response.status})`);
    }
    await Bun.write(file, response);

    const zip = await openZip(file);
    try {
      return await fn(zip);
    } finally {
      await zip.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
