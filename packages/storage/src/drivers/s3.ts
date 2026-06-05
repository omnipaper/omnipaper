import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
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

const DEFAULT_UPLOAD_EXPIRY_SECONDS = 600;
const DEFAULT_DOWNLOAD_EXPIRY_SECONDS = 600;

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

    createUploadUrl: async ({ key, contentType, expiresInSeconds }) => {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRY_SECONDS,
      });

      return { url };
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
  };
};
