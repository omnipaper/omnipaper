import { describe, expect, it } from "bun:test";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  describeAcceptedFormats,
  extensionForMimeType,
  isUploadAllowed,
  matchesFileSignature,
  resolveUploadMimeType,
  UPLOAD_FORMATS,
} from "./formats";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("isUploadAllowed", () => {
  it("accepts each allow-listed extension (case-insensitive)", () => {
    expect(isUploadAllowed({ filename: "invoice.pdf" })).toBe(true);
    expect(isUploadAllowed({ filename: "photo.jpg" })).toBe(true);
    expect(isUploadAllowed({ filename: "photo.jpeg" })).toBe(true);
    expect(isUploadAllowed({ filename: "scan.PNG" })).toBe(true);
    expect(isUploadAllowed({ filename: "shot.WebP" })).toBe(true);
    expect(isUploadAllowed({ filename: "notes.txt" })).toBe(true);
    expect(isUploadAllowed({ filename: "letter.docx" })).toBe(true);
  });

  it("rejects extensions that are not on the list", () => {
    expect(isUploadAllowed({ filename: "malware.exe" })).toBe(false);
    expect(isUploadAllowed({ filename: "archive.zip" })).toBe(false);
    expect(isUploadAllowed({ filename: "anim.gif" })).toBe(false); // gif is OCR-only, not uploadable
    expect(isUploadAllowed({ filename: "legacy.doc" })).toBe(false); // old binary Word, not supported
    expect(isUploadAllowed({ filename: "sheet.xlsx" })).toBe(false);
  });

  it("treats the extension as authoritative over a spoofed MIME type", () => {
    // A forged image/pdf MIME must not sneak an executable past the gate.
    expect(isUploadAllowed({ filename: "malware.exe", mimeType: "application/pdf" })).toBe(false);
    // ...and an honest-but-unlisted extension is rejected even with an allowed MIME.
    expect(isUploadAllowed({ filename: "data.csv", mimeType: "text/plain" })).toBe(false);
  });

  it("falls back to the MIME type only when the filename has no usable extension", () => {
    expect(isUploadAllowed({ filename: "scan", mimeType: "application/pdf" })).toBe(true);
    expect(isUploadAllowed({ filename: "scan", mimeType: "application/zip" })).toBe(false);
    expect(isUploadAllowed({ mimeType: DOCX_MIME })).toBe(true);
  });

  it("rejects when neither a known extension nor a known MIME type is present", () => {
    expect(isUploadAllowed({})).toBe(false);
    expect(isUploadAllowed({ filename: "noext" })).toBe(false);
    expect(isUploadAllowed({ mimeType: "application/octet-stream" })).toBe(false);
    expect(isUploadAllowed({ filename: "", mimeType: "" })).toBe(false);
  });
});

describe("derived format data", () => {
  it("derives the accepted MIME and extension sets from UPLOAD_FORMATS", () => {
    expect(ACCEPTED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ACCEPTED_MIME_TYPES.has(DOCX_MIME)).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has(".jpeg")).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has(".docx")).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has(".gif")).toBe(false);
  });

  it("includes both extensions and MIME types in the accept attribute", () => {
    expect(ACCEPT_ATTRIBUTE).toContain(".pdf");
    expect(ACCEPT_ATTRIBUTE).toContain("image/webp");
    for (const format of UPLOAD_FORMATS) {
      for (const ext of format.extensions) {
        expect(ACCEPT_ATTRIBUTE).toContain(ext);
      }
    }
  });

  it("lists every format label in the human-readable description", () => {
    const description = describeAcceptedFormats();
    for (const format of UPLOAD_FORMATS) {
      expect(description).toContain(format.label);
    }
  });

  it("derives canonical extensions from accepted MIME types", () => {
    expect(extensionForMimeType("application/pdf")).toBe(".pdf");
    expect(extensionForMimeType("IMAGE/JPEG")).toBe(".jpg");
    expect(extensionForMimeType("text/plain;charset=utf-8")).toBe(".txt");
    expect(extensionForMimeType(DOCX_MIME)).toBe(".docx");
    expect(extensionForMimeType("text/csv")).toBeUndefined();
  });
});

describe("resolveUploadMimeType", () => {
  it("derives the type from the extension and ignores a spoofed MIME", () => {
    expect(resolveUploadMimeType({ filename: "invoice.png", mimeType: "image/svg+xml" })).toBe(
      "image/png",
    );
    expect(resolveUploadMimeType({ filename: "page.txt", mimeType: "text/html" })).toBe(
      "text/plain",
    );
    expect(resolveUploadMimeType({ filename: "photo.JPEG" })).toBe("image/jpeg");
  });

  it("falls back to an allow-listed MIME only without an extension", () => {
    expect(resolveUploadMimeType({ filename: "scan", mimeType: "application/pdf; x=1" })).toBe(
      "application/pdf",
    );
    expect(resolveUploadMimeType({ filename: "scan", mimeType: "image/svg+xml" })).toBeUndefined();
    expect(resolveUploadMimeType({ filename: "logo.svg", mimeType: "image/png" })).toBeUndefined();
  });
});

describe("matchesFileSignature", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const text = (value: string) => new TextEncoder().encode(value);

  it("accepts files whose leading bytes match the claimed format", () => {
    expect(matchesFileSignature("application/pdf", text("%PDF-1.7\n"))).toBe(true);
    expect(matchesFileSignature("application/pdf", text("junk\n%PDF-1.4"))).toBe(true);
    expect(matchesFileSignature("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(
      matchesFileSignature("image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe(true);
    expect(matchesFileSignature("image/webp", text("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(matchesFileSignature(DOCX_MIME, bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
    expect(matchesFileSignature("text/plain", text("<svg>"))).toBe(true);
  });

  it("rejects SVG or HTML posing as an image or PDF", () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(matchesFileSignature("image/png", svg)).toBe(false);
    expect(matchesFileSignature("image/jpeg", svg)).toBe(false);
    expect(matchesFileSignature("image/webp", svg)).toBe(false);
    expect(matchesFileSignature("application/pdf", svg)).toBe(false);
    expect(matchesFileSignature(DOCX_MIME, svg)).toBe(false);
    expect(matchesFileSignature("image/png", new Uint8Array())).toBe(false);
  });

  it("rejects types outside the allow-list", () => {
    expect(matchesFileSignature("image/svg+xml", text("<svg/>"))).toBe(false);
  });
});
