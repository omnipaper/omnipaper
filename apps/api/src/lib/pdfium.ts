import { PDFiumLibrary } from "@hyzyla/pdfium";

// Init once per process: each init() allocates a ~18MB WASM heap that destroy() can't release, so
// per-call init grows RSS until restart. Callers load and destroy their own document handles.
let pdfiumLibraryPromise: Promise<PDFiumLibrary> | null = null;

export function getPdfiumLibrary(): Promise<PDFiumLibrary> {
  pdfiumLibraryPromise ??= PDFiumLibrary.init();
  return pdfiumLibraryPromise;
}

// True only when the file cannot be opened at all without a password. PDFs carrying just an owner
// password (the "no printing" kind) open fine and are deliberately not reported here — scanning the
// bytes for /Encrypt would wrongly reject those, since both kinds carry that marker.
export async function isPasswordProtectedPdf(bytes: Uint8Array): Promise<boolean> {
  const library = await getPdfiumLibrary();

  try {
    const document = await library.loadDocument(bytes);
    document.destroy();
    return false;
  } catch (err) {
    // pdfium maps its PASSWORD error code to this message and to no other; a wording change upstream
    // would degrade to today's behaviour (the file is accepted) rather than reject valid uploads.
    return err instanceof Error && /password/i.test(err.message);
  }
}
