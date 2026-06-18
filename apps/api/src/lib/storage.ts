import { getStorageConfig } from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";

export async function getStorageDriver() {
  const config = await getStorageConfig();

  if (!config) {
    return null;
  }

  return createS3Driver(config);
}
