import { getStorageSettings } from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";

export async function getStorageDriver() {
  const settings = await getStorageSettings();

  if (!settings) {
    return null;
  }

  return createS3Driver(settings);
}
