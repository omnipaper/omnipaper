import { getStorageConfig } from "@omnipaper/settings/storage-settings";
import type { StorageDriver } from "@omnipaper/storage/driver";
import { createS3Driver } from "@omnipaper/storage/s3";

// One S3 client for the whole process. Each S3Client owns a keep-alive HTTP agent + socket pool that
// the AWS SDK never frees until client.destroy(); building one per request/job (the old behaviour)
// leaked an agent on every call. The resolved storage config is effectively constant, so we cache the
// driver and only rebuild it — destroying the previous client first — when the config actually
// changes (an admin edits the storage settings) or is cleared.
let cached: { key: string; driver: StorageDriver } | null = null;

export async function getStorageDriver(): Promise<StorageDriver | null> {
  const config = await getStorageConfig();

  if (!config) {
    if (cached) {
      cached.driver.destroy();
      cached = null;
    }
    return null;
  }

  const key = JSON.stringify(config);

  if (cached?.key === key) {
    return cached.driver;
  }

  cached?.driver.destroy();
  cached = { key, driver: createS3Driver(config) };
  return cached.driver;
}
