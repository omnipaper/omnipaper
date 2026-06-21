import { cn } from "@omnipaper/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  MailIcon,
} from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { useDisplayProperties } from "@/features/documents/filters/display-properties";
import { type DocumentRow, thumbnailUrl } from "@/features/documents/queries/documents";
import { SelectCheckbox } from "@/features/documents/selection/select-checkbox";
import { TagChip } from "@/features/tags/components/tag-chip";
import { fileTypeLabel, formatCalendarDate, formatRelativeDay } from "@/lib/format";

type DocumentCardsProps = {
  orgId: string;
  documents: DocumentRow[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
};

function iconForMime(mimeType: string): ComponentType<{ className?: string }> {
  if (mimeType === "application/pdf") {
    return FileTextIcon;
  }
  if (mimeType.startsWith("image/")) {
    return FileImageIcon;
  }
  if (mimeType.startsWith("message/")) {
    return MailIcon;
  }
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheet")) {
    return FileSpreadsheetIcon;
  }
  return FileIcon;
}

// Display a pulsing skeleton while the thumbnail image loads, fade it in once loaded, and show a file-type icon if the image fails to load.
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
    return <Icon className="size-10 text-muted-foreground" />;
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
          "h-full w-full object-cover object-top transition-opacity duration-300 group-hover:opacity-90",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}

// Gallery layout. Each card shows the same Display properties as the list rows (driven by the shared
// localStorage store), just stacked under the thumbnail instead of laid out in row slots.
export function DocumentCards({ orgId, documents, isSelected, onToggle }: DocumentCardsProps) {
  const { isOn } = useDisplayProperties();

  function card(doc: DocumentRow) {
    const Icon = iconForMime(doc.mimeType);
    const selected = isSelected(doc.id);
    const fileType = isOn("fileType") ? fileTypeLabel(doc.mimeType) : null;
    const typeName = isOn("documentType") ? doc.documentTypeName : null;
    const showTags = isOn("tags") && doc.tags.length > 0;
    const docDate = isOn("date") && doc.documentDate ? formatCalendarDate(doc.documentDate) : null;
    const added = isOn("created") ? `Added ${formatRelativeDay(doc.createdAt)}` : null;

    return (
      <li key={doc.id} className="group relative">
        <div
          className={cn(
            "absolute top-2 left-2 z-10 transition-opacity",
            // Reveal on hover; keep it visible once selected so the selection stays legible.
            selected ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <SelectCheckbox
            checked={selected}
            onToggle={(shiftKey) => onToggle(doc.id, shiftKey)}
            label={`Select ${doc.title}`}
          />
        </div>
        <Link
          to="/dashboard/orgs/$orgId/documents/$id"
          params={{ orgId, id: doc.id }}
          className="group flex flex-col gap-2"
        >
          <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {doc.thumbnailStatus === "completed" ? (
              <Thumbnail src={thumbnailUrl(orgId, doc.id)} alt={doc.title} Icon={Icon} />
            ) : doc.thumbnailStatus === "pending" || doc.thumbnailStatus === "processing" ? (
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            ) : (
              <Icon className="size-10 text-muted-foreground" />
            )}
            {/* Tags overlay the thumbnail — right-aligned, stacked top-to-bottom — since the
                metadata row below has no room for them. Cap at 4; more won't fit the card height. */}
            {showTags ? (
              <div className="absolute top-2 right-2 z-10 flex max-w-[80%] flex-col items-end gap-1">
                {doc.tags.slice(0, 4).map((tag) => (
                  <TagChip
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    className="max-w-full shadow-sm"
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="line-clamp-2 font-medium text-sm group-hover:underline">
              {doc.title}
            </span>

            {fileType || typeName ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {fileType ? (
                  <span className="rounded-md border px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground">
                    {fileType}
                  </span>
                ) : null}
                {typeName ? (
                  <span className="max-w-full truncate rounded-md border px-2 py-0.5 text-foreground text-xs">
                    {typeName}
                  </span>
                ) : null}
              </div>
            ) : null}

            {docDate || added ? (
              <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
                {docDate ? <span>{docDate}</span> : null}
                {docDate && added ? <span aria-hidden>·</span> : null}
                {added ? <span>{added}</span> : null}
              </div>
            ) : null}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {documents.map(card)}
    </ul>
  );
}
