export type MultipartPart = { partNumber: number; etag: string };

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

  createMultipartUpload: (args: {
    key: string;
    contentType: string;
  }) => Promise<{ uploadId: string }>;

  signUploadPart: (args: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds?: number;
  }) => Promise<{ url: string }>;

  completeMultipartUpload: (args: {
    key: string;
    uploadId: string;
    parts: MultipartPart[];
  }) => Promise<void>;

  abortMultipartUpload: (args: { key: string; uploadId: string }) => Promise<void>;
};
