import { Button } from "@omnipaper/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// pdf.js does its rendering in a web worker. Vite resolves this URL at build time,
// so the worker is bundled and served alongside the app — no CDN, no public/ copy.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// Note: we intentionally don't wire cMapUrl / standardFontDataUrl. Latin PDFs render
// fine; if we ever hit CJK or non-embedded standard fonts we can point those at the
// bundled pdfjs-dist assets.

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) {
        setWidth(next);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function PdfPreview({ url }: { url: string }) {
  const { ref, width } = useContainerWidth();
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);

  return (
    <div ref={ref} className="flex flex-col items-center gap-3">
      <Document
        file={url}
        onLoadSuccess={({ numPages: total }) => {
          setNumPages(total);
          setPage(1);
        }}
        loading={<p className="text-sm text-muted-foreground">Ładowanie podglądu…</p>}
        error={<p className="text-sm text-destructive">Nie udało się wczytać PDF.</p>}
      >
        {width ? (
          <Page pageNumber={page} width={width} className="overflow-hidden rounded-md border" />
        ) : null}
      </Document>

      {numPages > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Poprzednia
          </Button>
          <span className="text-muted-foreground">
            Strona {page} z {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
          >
            Następna
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentPreview({ url, mimeType }: { url?: string; mimeType: string }) {
  if (!url) {
    return <p className="text-sm text-muted-foreground">Ładowanie podglądu…</p>;
  }

  if (mimeType === "application/pdf") {
    return <PdfPreview url={url} />;
  }

  if (mimeType.startsWith("image/")) {
    return (
      <img
        src={url}
        alt="Podgląd dokumentu"
        className="max-h-[70vh] w-full rounded-md border object-contain"
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Podgląd niedostępny dla tego typu pliku ({mimeType}). Użyj przycisku Pobierz.
    </p>
  );
}
