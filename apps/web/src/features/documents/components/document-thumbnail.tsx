import { cn } from "@omnipaper/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { type DocumentRow, thumbnailUrl } from "@/features/documents/queries/documents";
import documentIcon from "./file-icons/document.svg";
import emailIcon from "./file-icons/email.svg";
import imageIcon from "./file-icons/image.svg";
import pdfIcon from "./file-icons/pdf.svg";
import tableIcon from "./file-icons/table.svg";
import wordIcon from "./file-icons/word.svg";

function svgIcon(src: string): ComponentType<{ className?: string }> {
  return function FileTypeSvg({ className }: { className?: string }) {
    return <img src={src} alt="" aria-hidden className={className} />;
  };
}

const PdfIcon = svgIcon(pdfIcon);
const ImageIcon = svgIcon(imageIcon);
const EmailIcon = svgIcon(emailIcon);
const TableIcon = svgIcon(tableIcon);
const WordIcon = svgIcon(wordIcon);
const DocumentIcon = svgIcon(documentIcon);

export function fileTypeIcon(mimeType: string): ComponentType<{ className?: string }> {
  if (mimeType === "application/pdf") {
    return PdfIcon;
  }
  if (mimeType.startsWith("image/")) {
    return ImageIcon;
  }
  if (mimeType.startsWith("message/")) {
    return EmailIcon;
  }
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheet")) {
    return TableIcon;
  }
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml")) {
    return WordIcon;
  }
  return DocumentIcon;
}

function Thumbnail({
  src,
  alt,
  Icon,
}: {
  src: string;
  alt: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  // A cached thumbnail can finish loading before React attaches onLoad — catch that on mount.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) {
      setStatus(img.naturalWidth > 0 ? "loaded" : "error");
    }
  }, []);

  if (status === "error") {
    return <Icon className="size-10" />;
  }

  return (
    <>
      {status === "loading" ? <div className="absolute inset-0 animate-pulse bg-muted" /> : null}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "h-full w-full object-cover object-top outline-1 -outline-offset-1 outline-black/10 transition-opacity duration-300 group-hover:opacity-90 dark:outline-white/10",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}

export function DocumentThumbnail({
  orgId,
  doc,
}: {
  orgId: string;
  doc: Pick<DocumentRow, "id" | "title" | "mimeType" | "thumbnailStatus">;
}) {
  const Icon = fileTypeIcon(doc.mimeType);

  if (doc.thumbnailStatus === "completed") {
    return <Thumbnail src={thumbnailUrl(orgId, doc.id)} alt={doc.title} Icon={Icon} />;
  }
  if (doc.thumbnailStatus === "pending" || doc.thumbnailStatus === "processing") {
    return <Loader2Icon className="size-8 animate-spin text-muted-foreground" />;
  }
  return <Icon className="size-10" />;
}
