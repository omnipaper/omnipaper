// One uploaded part of a multipart upload, as reported back by storage (the ETag) so it can be
// listed at completion time.
export type MultipartPart = { partNumber: number; etag: string };

export type StorageDriver = {
  name: string;

  putObject: (args: { key: string; body: Uint8Array; contentType: string }) => Promise<void>;

  createDownloadUrl: (args: { key: string; expiresInSeconds?: number }) => Promise<{ url: string }>;

  deleteObject: (args: { key: string }) => Promise<void>;

  objectExists: (args: { key: string }) => Promise<boolean>;

  testConnection: () => Promise<void>;

  // Multipart upload — for objects past the single-PUT ceiling (~5 GiB on S3/R2), e.g. migration
  // export ZIPs. The browser PUTs each part straight to storage via a presigned part URL; the server
  // only initiates, signs, and completes (it never streams the bytes).
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
