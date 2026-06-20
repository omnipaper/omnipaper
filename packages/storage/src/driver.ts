export type StorageDriver = {
  name: string;

  putObject: (args: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;

  createDownloadUrl: (args: { key: string; expiresInSeconds?: number }) => Promise<{ url: string }>;

  getObject: (args: {
    key: string;
  }) => Promise<{ body: ArrayBuffer; contentType: string | null } | null>;

  deleteObject: (args: { key: string }) => Promise<void>;

  objectExists: (args: { key: string }) => Promise<boolean>;

  testConnection: () => Promise<void>;

  // Tear down the underlying client (its keep-alive HTTP agent + pooled sockets). Only call this for
  // a driver built from a transient/one-off config that won't be reused — the shared cached driver
  // (see apps/api/src/lib/storage.ts) is meant to live for the whole process.
  destroy: () => void;
};
