import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@omnipaper/env";

// Derive the 32-byte AES-256 key from ENCRYPTION_KEY with SHA-256, so the env var can be any
// sufficiently-long random string (length floor enforced in @omnipaper/env) instead of a
// pre-encoded 32-byte value. Deterministic, so already-encrypted data stays decryptable.
function getKey(): Buffer {
  return createHash("sha256").update(env.ENCRYPTION_KEY, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(":");
  const ivB64 = parts[0];
  const tagB64 = parts[1];

  // dataB64 may legitimately be empty (the ciphertext of an empty string), so validate the
  // structure — 3 parts with iv + tag present — rather than the truthiness of the data segment.
  if (parts.length !== 3 || !ivB64 || !tagB64) {
    throw new Error("Invalid ciphertext format");
  }

  const dataB64 = parts[2] ?? "";

  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
