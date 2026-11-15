// All engines speak S3; a definition is a preset that derives forcePathStyle and shapes the
// settings form, so the admin never deals with path-style or the "auto" region.
export type StorageDefinition = {
  id: string;
  label: string;
  forcePathStyle: boolean;
  endpoint: { shown: boolean; required: boolean; placeholder: string | null };
  // When hidden, fixedValue is the effective region (R2 ignores it but the SDK requires one).
  region: { shown: boolean; fixedValue: string | null; placeholder: string | null };
};

export const STORAGE_DEFINITIONS = {
  s3: {
    id: "s3",
    label: "AWS S3",
    forcePathStyle: false,
    endpoint: { shown: false, required: false, placeholder: null },
    region: { shown: true, fixedValue: null, placeholder: "us-east-1" },
  },
  r2: {
    id: "r2",
    label: "Cloudflare R2",
    forcePathStyle: false,
    endpoint: {
      shown: true,
      required: true,
      placeholder: "https://<account>.r2.cloudflarestorage.com",
    },
    region: { shown: false, fixedValue: "auto", placeholder: null },
  },
  minio: {
    id: "minio",
    label: "MinIO",
    forcePathStyle: true,
    endpoint: { shown: true, required: true, placeholder: "http://localhost:9000" },
    region: { shown: false, fixedValue: "us-east-1", placeholder: null },
  },
} as const satisfies Record<string, StorageDefinition>;

export type StorageEngineId = keyof typeof STORAGE_DEFINITIONS;

export const DEFAULT_STORAGE_ENGINE: StorageEngineId = "s3";

export const STORAGE_ENGINE_IDS = Object.keys(STORAGE_DEFINITIONS) as StorageEngineId[];
