import { PDFiumLibrary } from "@hyzyla/pdfium";

// Init once per process: each init() allocates a ~18MB WASM heap that destroy() can't free.
let pdfiumLibraryPromise: Promise<PDFiumLibrary> | null = null;

export function getPdfiumLibrary(): Promise<PDFiumLibrary> {
  pdfiumLibraryPromise ??= PDFiumLibrary.init();
  return pdfiumLibraryPromise;
}

// Owner-password-only PDFs open fine and are accepted; /Encrypt alone can't tell the two apart.
export async function isPasswordProtectedPdf(bytes: Uint8Array): Promise<boolean> {
  const library = await getPdfiumLibrary();

  try {
    const document = await library.loadDocument(bytes);
    document.destroy();
    return false;
  } catch (err) {
    // Only pdfium's PASSWORD error uses this wording; if it changes, files get accepted.
    return err instanceof Error && /password/i.test(err.message);
  }
}
