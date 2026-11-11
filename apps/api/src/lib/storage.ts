import { getStorageConfig } from "@omnipaper/settings/storage-settings";
import type { StorageDriver } from "@omnipaper/storage/driver";
import { createS3Driver } from "@omnipaper/storage/s3";

// Process-wide: each S3Client holds a keep-alive socket pool that is only freed by destroy(), so a
// client per call leaks. Rebuild (destroying the old one) only when the storage config changes.
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
