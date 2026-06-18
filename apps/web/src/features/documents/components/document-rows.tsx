import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { useDisplayProperties } from "@/features/documents/filters/display-properties";
import type { DocumentRow } from "@/features/documents/queries/documents";
import { SelectCheckbox } from "@/features/documents/selection/select-checkbox";
import { TagChip } from "@/features/tags/components/tag-chip";
import { fileTypeLabel, formatCalendarDate, formatRelativeDay } from "@/lib/format";

type DocumentRowsProps = {
  orgId: string;
  documents: DocumentRow[];
  isSelected: (id: string) => boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
};

function renderSnippet(snippet: string) {
  return snippet.split(/(<mark>.*?<\/mark>)/g).map((part, index) => {
    const isMark = part.startsWith("<mark>");
    return {
      key: index,
      isMark,
      text: isMark ? part.slice("<mark>".length, -"</mark>".length) : part,
    };
  });
}

// Renders the document list. Which metadata each row shows is driven by the user's Display
// properties (localStorage). Callers handle loading / error / empty states, since those differ per
// view.
export function DocumentRows({ orgId, documents, isSelected, onToggle }: DocumentRowsProps) {
  const { isOn } = useDisplayProperties();

  function row(doc: DocumentRow) {
    // Each field has a fixed slot so columns line up down the list: file type pinned left, the dates
    // pinned right, and the variable-length document type bounded to a chip in between — so nothing
    // shifts the others around (the old "·"-joined line was unreadable because items slid sideways).
    const typeName = isOn("type") ? doc.documentTypeName : null;
    const showTags = isOn("tags") && doc.tags.length > 0;
    const docDate = isOn("date") && doc.documentDate ? formatCalendarDate(doc.documentDate) : null;
    const added = isOn("created") ? `Added ${formatRelativeDay(doc.createdAt)}` : null;

    return (
      <li key={doc.id} className="flex items-start hover:bg-accent">
        <div className="flex shrink-0 items-start pt-3.5 pl-4">
          <SelectCheckbox
            checked={isSelected(doc.id)}
            onToggle={(shiftKey) => onToggle(doc.id, shiftKey)}
            label={`Select ${doc.title}`}
          />
        </div>
        <Link
          to="/dashboard/orgs/$orgId/documents/$id"
          params={{ orgId, id: doc.id }}
          className="flex flex-1 items-start gap-3 py-3 pr-4 pl-3"
        >
          {isOn("fileType") ? (
            <span className="mt-0.5 w-11 shrink-0 rounded-md border py-0.5 text-center font-medium text-[11px] text-muted-foreground">
              {fileTypeLabel(doc.mimeType)}
            </span>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate font-medium">{doc.title}</span>

            {typeName || showTags ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {typeName ? (
                  <span className="max-w-[170px] truncate rounded-md border px-2 py-0.5 text-foreground text-xs">
                    {typeName}
                  </span>
                ) : null}
                {showTags
                  ? doc.tags.map((tag) => (
                      <TagChip key={tag.id} name={tag.name} color={tag.color} />
                    ))
                  : null}
              </div>
            ) : null}

            {doc.snippet ? (
              <p className="line-clamp-2 text-muted-foreground text-sm">
                {renderSnippet(doc.snippet).map((part) =>
                  part.isMark ? (
                    <mark key={part.key} className="rounded bg-yellow-200 text-foreground">
                      {part.text}
                    </mark>
                  ) : (
                    <Fragment key={part.key}>{part.text}</Fragment>
                  ),
                )}
              </p>
            ) : null}
          </div>

          {docDate || added ? (
            <div className="flex shrink-0 flex-col items-end gap-0.5 whitespace-nowrap text-muted-foreground text-xs">
              {docDate ? <span>{docDate}</span> : null}
              {added ? <span>{added}</span> : null}
            </div>
          ) : null}
        </Link>
      </li>
    );
  }

  return <ul className="divide-y rounded-md border">{documents.map(row)}</ul>;
}
