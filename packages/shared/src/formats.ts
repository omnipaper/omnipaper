// ── Upload allow-list — which file types the app accepts AT ALL ─────────────
//
// This is the GATE, and it is a DIFFERENT concern from OCR support — two lists, kept separate:
//
//   • UPLOAD ALLOW-LIST (here)              — which files may enter the app at all. Enforced
//                                             server-side at the upload route; mirrored as the
//                                             `accept=` hint and a client-side pre-check in the web
//                                             upload UI.
//   • OCR SUPPORT (@omnipaper/ocr/registry) — which of the accepted types OCR can read. A separate,
//                                             narrower list that lives with the OCR registry.
//
// Invariant: every OCR-supported MIME is also on this allow-list (you can't OCR a file the app never
// accepted) — this list is the superset. The two stay separate so the gate and OCR can evolve
// independently.
//
// Adding a format here updates all three consumers at once: the server gate, the `accept=`
// attribute, and the "supported formats" error message. One source of truth.

export type UploadFormat = {
  /** Stable id, also the lookup key. */
  id: string;
  /** User-facing label for messages and UI. */
  label: string;
  /** Lower-case extensions including the dot; the first is the canonical one. */
  extensions: readonly string[];
  /** MIME types a browser may report for this format; the first is the canonical one. */
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

/** Value for a web `<input type="file">` `accept` attribute — extensions plus MIME types. */
export const ACCEPT_ATTRIBUTE: string = [
  ...UPLOAD_FORMATS.flatMap((format) => format.extensions),
  ...UPLOAD_FORMATS.flatMap((format) => format.mimeTypes),
].join(",");

/** Lower-cased extension including the dot, or "" when the name carries none. */
function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot).toLowerCase() : "";
}

// The filename extension is authoritative when present: the browser-supplied MIME string is
// spoofable and often empty, whereas the extension reflects the file the user actually picked. The
// claimed MIME is only the fallback for the rare extension-less file. This is a format gate, not a
// content check — magic-byte sniffing is a separate hardening step layered on top later.
export function isUploadAllowed(input: { filename?: string; mimeType?: string }): boolean {
  const ext = input.filename ? extensionOf(input.filename) : "";

  if (ext) {
    return ACCEPTED_EXTENSIONS.has(ext);
  }

  return input.mimeType ? ACCEPTED_MIME_TYPES.has(input.mimeType) : false;
}

/** Human-readable list of accepted formats for error messages and UI, e.g. "PDF, JPEG image, …". */
export function describeAcceptedFormats(): string {
  return UPLOAD_FORMATS.map((format) => format.label).join(", ");
}
