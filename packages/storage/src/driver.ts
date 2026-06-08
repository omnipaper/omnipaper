export type StorageDriver = {
  name: string;

  putObject: (args: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;

  createDownloadUrl: (args: { key: string; expiresInSeconds?: number }) => Promise<{ url: string }>;

  deleteObject: (args: { key: string }) => Promise<void>;

  objectExists: (args: { key: string }) => Promise<boolean>;

  testConnection: () => Promise<void>;
};
