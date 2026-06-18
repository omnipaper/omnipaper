import { STORAGE_DEFINITIONS, type StorageDefinition, type StorageEngineId } from "./registry";

export function getStorageDefinition(id: string): StorageDefinition {
  const definition = STORAGE_DEFINITIONS[id as StorageEngineId];

  if (!definition) {
    throw new Error(`Unknown storage engine: ${id}`);
  }

  return definition;
}

export function isStorageEngine(id: string): id is StorageEngineId {
  return id in STORAGE_DEFINITIONS;
}

export function listStorageDefinitions(): StorageDefinition[] {
  return Object.values(STORAGE_DEFINITIONS);
}
