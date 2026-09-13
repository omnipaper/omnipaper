import { cn } from "@omnipaper/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { CalendarIcon, ClockIcon, FolderIcon, ShapesIcon } from "lucide-react";
import {
  DocumentThumbnail,
  fileTypeIcon,
} from "@/features/documents/components/document-thumbnail";
import { useDisplayProperties } from "@/features/documents/filters/display-properties";
import type { DocumentRow } from "@/features/documents/queries/documents";
import { SelectCheckbox } from "@/features/documents/selection/select-checkbox";
import { TagChip } from "@/features/tags/components/tag-chip";
import {
  fileTypeLabel,
  formatCalendarDate,
  formatInstantDate,
  formatRelativeDay,
} from "@/lib/format";

type DocumentCardsProps = {
  orgId: string;
  documents: DocumentRow[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
};

// Gallery layout. Each card shows the same Display properties as the list rows (driven by the shared
// localStorage store), just stacked under the thumbnail instead of laid out in row slots.
export function DocumentCards({ orgId, documents, isSelected, onToggle }: DocumentCardsProps) {
  const { isOn } = useDisplayProperties();

  function card(doc: DocumentRow) {
    const Icon = fileTypeIcon(doc.mimeType);
    const selected = isSelected(doc.id);
    const fileType = isOn("fileType") ? fileTypeLabel(doc.mimeType) : null;
    const typeName = isOn("documentType") ? doc.documentTypeName : null;
    const showTags = isOn("tags") && doc.tags.length > 0;
    const docDate = isOn("date") && doc.documentDate ? formatCalendarDate(doc.documentDate) : null;
    const added = isOn("created") ? formatRelativeDay(doc.createdAt) : null;
    const pathName = isOn("path") ? doc.storagePathName : null;

    return (
      <li key={doc.id} className="group relative">
        <div
          className={cn(
            "absolute top-4 left-4 z-10 transition-opacity",
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
          className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-2 transition-colors hover:border-foreground/20"
        >
          <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <DocumentThumbnail orgId={orgId} doc={doc} />
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
            {fileType ? (
              <span className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md border bg-background/90 px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
                <Icon className="size-3 shrink-0" />
                {fileType}
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 px-1 pb-1">
            {/* Marquee: on hover the title slides left by exactly its overflow (100cqw container, 100% text). */}
            <span
              title={doc.title}
              className="block overflow-hidden whitespace-nowrap font-medium text-sm [container-type:inline-size] [mask-image:linear-gradient(to_right,black_calc(100%-12px),transparent)] group-hover:underline"
            >
              <span className="inline-block w-max transition-transform delay-200 duration-1000 ease-linear motion-safe:group-hover:[transform:translateX(min(0px,calc(100cqw-100%)))]">
                {doc.title}
              </span>
            </span>

            {typeName ? (
              <span
                className="flex items-center gap-1 text-muted-foreground text-xs"
                title="Document type"
              >
                <ShapesIcon className="size-3 shrink-0" />
                <span className="min-w-0 truncate">{typeName}</span>
              </span>
            ) : null}

            {pathName ? (
              <span
                className="flex items-center gap-1 text-muted-foreground text-xs"
                title="Storage path"
              >
                <FolderIcon className="size-3 shrink-0" />
                <span className="min-w-0 truncate">{pathName}</span>
              </span>
            ) : null}

            {docDate || added ? (
              <div className="flex flex-col gap-1 text-muted-foreground text-xs tabular-nums">
                {docDate ? (
                  <span className="flex items-center gap-1" title="Document date">
                    <CalendarIcon className="size-3 shrink-0" />
                    {docDate}
                  </span>
                ) : null}
                {added ? (
                  <span
                    className="flex items-center gap-1"
                    title={`Added ${formatInstantDate(doc.createdAt)}`}
                  >
                    <ClockIcon className="size-3 shrink-0" />
                    {added}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </Link>
      </li>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {documents.map(card)}
    </ul>
  );
}
