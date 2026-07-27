import { PDFiumLibrary } from "@hyzyla/pdfium";

// PDFium's WASM heap is allocated once and reused for every call. Running PDFiumLibrary.init() per
// use builds a fresh Emscripten module with its own ~18MB WebAssembly.Memory, and library.destroy()
// only runs pdfium's C-level teardown — it cannot release that heap, and WASM memory never shrinks,
// so every processed PDF would abandon a heap the GC reclaims slowly and RSS climbs until restart.
// One shared library fixes it: pdfium is designed to init once and load many documents, and both
// callers (ingest, thumbnail worker) are async on a single JS thread, so they just load and destroy
// their own document handles against the one bounded heap.
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
