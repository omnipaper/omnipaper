// Storage "engines" are all the same S3 protocol — the difference is purely how the S3 client is
// configured. So unlike the OCR registry (which encodes real per-lane behaviour), a StorageDefinition
// is a *preset*: it derives forcePathStyle and shapes which fields the settings form shows, so the
// admin never has to know low-level S3 quirks (path-style, the "auto" region, etc.).
export type StorageDefinition = {
  id: string;
  label: string;
  // Derived from the engine, never chosen by the admin.
  forcePathStyle: boolean;
  // How the settings form treats the endpoint field for this engine.
  endpoint: { shown: boolean; required: boolean; placeholder: string | null };
  // How the settings form treats the region field. When hidden, fixedValue is used as the
  // effective region (R2 ignores it but the SDK requires a value; MinIO accepts anything).
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
