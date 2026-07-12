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

// Use the file extension to check format when available; fall back to MIME type if not. This only filters by declared type, not actual file contents.
export function isUploadAllowed(input: { filename?: string; mimeType?: string }): boolean {
  const ext = input.filename ? extensionOf(input.filename) : "";

  if (ext) {
    return ACCEPTED_EXTENSIONS.has(ext);
  }

  return input.mimeType ? ACCEPTED_MIME_TYPES.has(normalizeMimeType(input.mimeType)) : false;
}

// One ceiling for every ingest path (HTTP upload, email attachments).
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function describeAcceptedFormats(): string {
  return UPLOAD_FORMATS.map((format) => format.label).join(", ");
}
