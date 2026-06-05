export type StorageDriver = {
  name: string;

  createUploadUrl: (args: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) => Promise<{ url: string }>;

  createDownloadUrl: (args: {
    key: string;
    expiresInSeconds?: number;
  }) => Promise<{ url: string }>;

  deleteObject: (args: { key: string }) => Promise<void>;

  objectExists: (args: { key: string }) => Promise<boolean>;

  testConnection: () => Promise<void>;
};
