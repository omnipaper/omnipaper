// List of file types the app accepts for upload (not OCR-specific). Update here to change all upload gates.

export type UploadFormat = {
  id: string;
  label: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
};

export const UPLOAD_FORMATS = [
  { id: "pdf", label: "PDF", extensions: [".pdf"], mimeTypes: ["application/pdf"] },
  { id: "jpeg", label: "JPEG image", extensions: [".jpg", ".jpeg"], mimeTypes: ["image/jpeg"] },
  { id: "png", label: "PNG image", extensions: [".png"], mimeTypes: ["image/png"] },
  { id: "webp", label: "WebP image", extensions: [".webp"], mimeTypes: ["image/webp"] },
  { id: "txt", label: "Plain text", extensions: [".txt"], mimeTypes: ["text/plain"] },
  {
    id: "docx",
    label: "Word document (.docx)",
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
] as const satisfies readonly UploadFormat[];

export const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set(
  UPLOAD_FORMATS.flatMap((format) => format.mimeTypes),
);

export const ACCEPTED_EXTENSIONS: ReadonlySet<string> = new Set(
  UPLOAD_FORMATS.flatMap((format) => format.extensions),
);

export const ACCEPT_ATTRIBUTE: string = [
  ...UPLOAD_FORMATS.flatMap((format) => format.extensions),
  ...UPLOAD_FORMATS.flatMap((format) => format.mimeTypes),
].join(",");

// Removes parameters from a MIME type (e.g., "text/plain;charset=utf-8" → "text/plain") and lowercases it for consistent, parameter-free matching.
export function normalizeMimeType(value: string): string {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function extensionForMimeType(mimeType: string): string | undefined {
  const normalized = normalizeMimeType(mimeType);

  return UPLOAD_FORMATS.find((format) =>
    format.mimeTypes.some((candidate) => candidate === normalized),
  )?.extensions[0];
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot).toLowerCase() : "";
}

// Canonical MIME type from the allow-list: the extension wins when there is one, the declared MIME is
// only a fallback. Never returns the caller's raw value, so a spoofed type (e.g. image/svg+xml on a
// .png) cannot reach storage or the response headers.
export function resolveUploadMimeType(input: {
  filename?: string;
  mimeType?: string;
}): string | undefined {
  const ext = input.filename ? extensionOf(input.filename) : "";

  if (ext) {
    return UPLOAD_FORMATS.find((format) => format.extensions.some((candidate) => candidate === ext))
      ?.mimeTypes[0];
  }

  const declared = input.mimeType ? normalizeMimeType(input.mimeType) : "";

  return ACCEPTED_MIME_TYPES.has(declared) ? declared : undefined;
}

export function isUploadAllowed(input: { filename?: string; mimeType?: string }): boolean {
  return resolveUploadMimeType(input) !== undefined;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
// PDF readers accept the header anywhere in the first 1 KiB.
const PDF_HEADER_WINDOW = 1024;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

// Checks the leading bytes against the format the MIME type claims. Plain text has no signature.
export function matchesFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  switch (normalizeMimeType(mimeType)) {
    case "application/pdf": {
      const last = Math.min(bytes.length - PDF_MAGIC.length, PDF_HEADER_WINDOW);
      for (let offset = 0; offset <= last; offset++) {
        if (startsWith(bytes, PDF_MAGIC, offset)) {
          return true;
        }
      }
      return false;
    }
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "text/plain":
      return true;
    default:
      return false;
  }
}

// Image types whose original bytes are safe to serve inline as their own thumbnail.
export const INLINE_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// One ceiling for every ingest path (HTTP upload, email attachments).
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function describeAcceptedFormats(): string {
  return UPLOAD_FORMATS.map((format) => format.label).join(", ");
}
