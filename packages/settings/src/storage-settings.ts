import { z } from "zod";
import { getSetting, setSetting } from "./settings";

export const storageSettingsSchema = z.object({
  bucket: z.string().min(1),
  region: z.string().min(1),
  endpoint: z.string().optional(),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  // Path-style addressing (bucket in the URL path, not the host). Required by some S3-compatibles
  // (e.g. MinIO) that don't support virtual-hosted-style; harmless on AWS/R2. Defaults off.
  forcePathStyle: z.boolean().optional(),
});

export type StorageSettings = z.infer<typeof storageSettingsSchema>;

const KEYS = {
  bucket: "storage.s3.bucket",
  region: "storage.s3.region",
  endpoint: "storage.s3.endpoint",
  accessKeyId: "storage.s3.accessKeyId",
  secretAccessKey: "storage.s3.secretAccessKey",
  forcePathStyle: "storage.s3.forcePathStyle",
} as const;

export async function getStorageSettings(): Promise<StorageSettings | null> {
  const raw = {
    bucket: await getSetting(KEYS.bucket),
    region: await getSetting(KEYS.region),
    endpoint: (await getSetting(KEYS.endpoint)) ?? undefined,
    accessKeyId: await getSetting(KEYS.accessKeyId),
    secretAccessKey: await getSetting(KEYS.secretAccessKey),
    // Stored as a "true"/"false" string in the KV table; absent → false.
    forcePathStyle: (await getSetting(KEYS.forcePathStyle)) === "true",
  };

  const parsed = storageSettingsSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}

export async function setStorageSettings(values: StorageSettings): Promise<void> {
  await setSetting({ key: KEYS.bucket, value: values.bucket });
  await setSetting({ key: KEYS.region, value: values.region });
  await setSetting({ key: KEYS.accessKeyId, value: values.accessKeyId, secret: true });
  await setSetting({ key: KEYS.secretAccessKey, value: values.secretAccessKey, secret: true });

  if (values.endpoint) {
    await setSetting({ key: KEYS.endpoint, value: values.endpoint });
  }

  await setSetting({
    key: KEYS.forcePathStyle,
    value: values.forcePathStyle ? "true" : "false",
  });
}
