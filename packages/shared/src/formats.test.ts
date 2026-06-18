import { describe, expect, it } from "bun:test";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  describeAcceptedFormats,
  isUploadAllowed,
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
});
