import { STORAGE_ENGINE_IDS, type StorageEngineId } from "@omnipaper/storage/registry";
import { getStorageDefinition } from "@omnipaper/storage/resolve";
import type { S3Config } from "@omnipaper/storage/s3";
import { z } from "zod";
import { deleteSetting, getSetting, setSetting } from "./settings";

// What the admin enters / what we persist: the chosen engine plus its relevant fields. Region and
// endpoint are optional here and validated per-engine below — forcePathStyle is never stored, it is
// derived from the engine in resolveStorageConfig().
export const storageSettingsSchema = z
  .object({
    engine: z.enum(STORAGE_ENGINE_IDS as [StorageEngineId, ...StorageEngineId[]]),
    bucket: z.string().min(1),
    region: z.string().optional(),
    endpoint: z.string().optional(),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    const definition = getStorageDefinition(value.engine);

    if (definition.region.shown && !value.region?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "Region is required",
      });
    }

    if (definition.endpoint.required && !value.endpoint?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endpoint"],
        message: "Endpoint is required",
      });
    }
  });

export type StorageSettings = z.infer<typeof storageSettingsSchema>;

const KEYS = {
  engine: "storage.engine",
  bucket: "storage.s3.bucket",
  region: "storage.s3.region",
  endpoint: "storage.s3.endpoint",
  accessKeyId: "storage.s3.accessKeyId",
  secretAccessKey: "storage.s3.secretAccessKey",
} as const;

export async function getStorageSettings(): Promise<StorageSettings | null> {
  const raw = {
    engine: await getSetting(KEYS.engine),
    bucket: await getSetting(KEYS.bucket),
    region: (await getSetting(KEYS.region)) ?? undefined,
    endpoint: (await getSetting(KEYS.endpoint)) ?? undefined,
    accessKeyId: await getSetting(KEYS.accessKeyId),
    secretAccessKey: await getSetting(KEYS.secretAccessKey),
  };

  const parsed = storageSettingsSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}

export async function setStorageSettings(values: StorageSettings): Promise<void> {
  const definition = getStorageDefinition(values.engine);

  await setSetting({ key: KEYS.engine, value: values.engine });
  await setSetting({ key: KEYS.bucket, value: values.bucket });
  await setSetting({ key: KEYS.accessKeyId, value: values.accessKeyId, secret: true });
  await setSetting({ key: KEYS.secretAccessKey, value: values.secretAccessKey, secret: true });

  // Region/endpoint are engine-dependent: persist only the fields this engine exposes, and clear
  // any value left over from a previous engine choice so a stale region/endpoint can't leak through.
  if (definition.region.shown && values.region) {
    await setSetting({ key: KEYS.region, value: values.region });
  } else {
    await deleteSetting(KEYS.region);
  }

  if (definition.endpoint.shown && values.endpoint) {
    await setSetting({ key: KEYS.endpoint, value: values.endpoint });
  } else {
    await deleteSetting(KEYS.endpoint);
  }
}

// Map admin-entered settings onto a concrete S3 client config. forcePathStyle and the region for
// endpoint-only engines (R2/MinIO) come from the engine definition, not from the admin.
export function resolveStorageConfig(settings: StorageSettings): S3Config {
  const definition = getStorageDefinition(settings.engine);

  return {
    bucket: settings.bucket,
    region: definition.region.fixedValue ?? settings.region ?? "",
    endpoint: definition.endpoint.shown ? settings.endpoint : undefined,
    forcePathStyle: definition.forcePathStyle,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
  };
}

export async function getStorageConfig(): Promise<S3Config | null> {
  const settings = await getStorageSettings();

  return settings ? resolveStorageConfig(settings) : null;
}
