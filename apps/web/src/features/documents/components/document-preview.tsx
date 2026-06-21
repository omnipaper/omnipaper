import { Button } from "@omnipaper/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { fileTypeLabel } from "@/lib/format";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// pdf.js does its rendering in a web worker. Vite resolves this URL at build time,
// so the worker is bundled and served alongside the app — no CDN, no public/ copy.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// Default config works for Latin PDFs; for CJK or special fonts, set cMapUrl or standardFontDataUrl as needed.
// Render width fits an A4 page per screen, never overflowing the container.
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

  // ~160px leaves room for the app header and padding. A4 aspect = √2.
  const heightBudget = Math.max(viewportHeight - 160, 360);
  const width = Math.min(containerWidth, Math.round(heightBudget / Math.SQRT2));

  return { ref, width };
}


function LazyPage({ pageNumber, width }: { pageNumber: number; width: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(pageNumber === 1);

  useEffect(() => {
    if (visible) {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Mount well before the page is on screen so scrolling stays smooth.
      { rootMargin: "300% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className="flex w-full justify-center"
      style={{ minHeight: visible ? undefined : Math.round(width * Math.SQRT2) }}
    >
      {visible ? (
        <Page pageNumber={pageNumber} width={width} className="rounded-md border" />
      ) : null}
    </div>
  );
}

function PdfPreview({ url, onRetry }: { url: string; onRetry?: () => void }) {
  const { ref, width } = useFitWidth();
  const [numPages, setNumPages] = useState(0);

  return (
    <div ref={ref} className="w-full">
      <Document
        file={url}
        onLoadSuccess={({ numPages: total }) => setNumPages(total)}
        className="flex flex-col items-center gap-4"
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
        {width
          ? Array.from({ length: numPages }, (_, index) => (
              <LazyPage key={index} pageNumber={index + 1} width={width} />
            ))
          : null}
      </Document>
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Preview not available for this file type ({fileTypeLabel(mimeType)}). Use the Download
        button.
      </p>
    </div>
  );
}
