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

// Render width that fits a normal (A4 portrait) page within the viewport height, so the whole page
// shows by default without an inner scrollbar. Capped by the container width so it never overflows
// horizontally; pages taller than A4 simply let the surrounding pane scroll.
function useFitWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) {
        setContainerWidth(next);
      }
    });
    observer.observe(el);

    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (containerWidth === undefined) {
    return { ref, width: undefined };
  }

  // ~200px leaves room for the app header, the two page-nav bars and padding. A4 aspect = √2.
  const heightBudget = Math.max(viewportHeight - 200, 360);
  const width = Math.min(containerWidth, Math.round(heightBudget / Math.SQRT2));

  return { ref, width };
}

function PageNav({
  page,
  numPages,
  onChange,
}: {
  page: number;
  numPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {numPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.min(numPages, page + 1))}
        disabled={page >= numPages}
      >
        Next
      </Button>
    </div>
  );
}

function PdfPreview({ url, onRetry }: { url: string; onRetry?: () => void }) {
  const { ref, width } = useFitWidth();
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const hasPages = numPages > 1;

  return (
    <div ref={ref} className="flex flex-col items-center gap-3">
      {hasPages ? <PageNav page={page} numPages={numPages} onChange={setPage} /> : null}
      <Document
        file={url}
        onLoadSuccess={({ numPages: total }) => {
          setNumPages(total);
          setPage(1);
        }}
        loading={<p className="text-sm text-muted-foreground">Loading preview…</p>}
        error={
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-destructive">Could not load PDF.</p>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        }
      >
        {width ? <Page pageNumber={page} width={width} className="rounded-md border" /> : null}
      </Document>

      {hasPages ? <PageNav page={page} numPages={numPages} onChange={setPage} /> : null}
    </div>
  );
}

export function DocumentPreview({
  url,
  mimeType,
  title,
  onRetry,
}: {
  url?: string;
  mimeType: string;
  title?: string;
  onRetry?: () => void;
}) {
  if (!url) {
    return <p className="text-sm text-muted-foreground">Loading preview…</p>;
  }

  if (mimeType === "application/pdf") {
    // key={url} remounts on document/url change so page/numPages can't carry over from a
    // previously viewed document (which would briefly render a page index out of bounds).
    return <PdfPreview key={url} url={url} onRetry={onRetry} />;
  }

  if (mimeType.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={title ? `Preview of ${title}` : "Document preview"}
        className="max-h-[70vh] w-full rounded-md border object-contain"
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Preview not available for this file type ({mimeType}). Use the Download button.
    </p>
  );
}
