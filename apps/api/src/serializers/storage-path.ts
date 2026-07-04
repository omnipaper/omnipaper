import type { StoragePath } from "@omnipaper/database/schema";

export function toStoragePathDto(storagePath: StoragePath) {
  return {
    id: storagePath.id,
    path: storagePath.path,
    description: storagePath.description,
    aiEligible: storagePath.aiEligible,
    createdAt: storagePath.createdAt,
    updatedAt: storagePath.updatedAt,
  };
}
