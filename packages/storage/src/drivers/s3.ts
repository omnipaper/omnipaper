import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver } from "../driver";

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

const DEFAULT_DOWNLOAD_EXPIRY_SECONDS = 600;
// Part URLs are signed on demand, one per part right before it uploads, so a generous-but-bounded
// window covers a slow part without pre-signing the whole (possibly huge) upload up front.
const DEFAULT_UPLOAD_PART_EXPIRY_SECONDS = 60 * 60;

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "NotFound" || error.name === "NoSuchKey")
  );
}

export const createS3Driver = (config: S3Config): StorageDriver => {
  const { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle } = config;

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    name: "s3",

    putObject: async ({ key, body, contentType }) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    createDownloadUrl: async ({ key, expiresInSeconds }) => {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });

      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds ?? DEFAULT_DOWNLOAD_EXPIRY_SECONDS,
      });

      return { url };
    },

    deleteObject: async ({ key }) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    objectExists: async ({ key }) => {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (error) {
        if (isNotFoundError(error)) {
          return false;
        }

        throw error;
      }
    },

    testConnection: async () => {
      // HeadObject on a dummy key: a "not found" means creds + bucket are fine (the key just
      // doesn't exist); an auth/bucket error throws and surfaces as a failed test.
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: "__omnipaper_connection_test__" }),
        );
      } catch (error) {
        if (isNotFoundError(error)) {
          return;
        }

        throw error;
      }
    },

    createMultipartUpload: async ({ key, contentType }) => {
      const result = await client.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      );

      if (!result.UploadId) {
        throw new Error("S3 did not return an UploadId for the multipart upload");
      }

      return { uploadId: result.UploadId };
    },

    signUploadPart: async ({ key, uploadId, partNumber, expiresInSeconds }) => {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds ?? DEFAULT_UPLOAD_PART_EXPIRY_SECONDS,
      });

      return { url };
    },

    completeMultipartUpload: async ({ key, uploadId, parts }) => {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          // S3 requires parts in ascending PartNumber order; sort defensively in case the caller
          // collected ETags out of order.
          MultipartUpload: {
            Parts: [...parts]
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        }),
      );
    },

    abortMultipartUpload: async ({ key, uploadId }) => {
      await client.send(
        new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
      );
    },
  };
};
