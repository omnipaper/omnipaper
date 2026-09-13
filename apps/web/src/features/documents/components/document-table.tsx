import type { SortState } from "@omnipaper/shared/document-filters";
import type { FolderNode } from "@omnipaper/shared/storage-paths";
import { cn } from "@omnipaper/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, FolderIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { fileTypeIcon } from "@/features/documents/components/document-thumbnail";
import type { DocumentRow } from "@/features/documents/queries/documents";
import { SelectCheckbox } from "@/features/documents/selection/select-checkbox";
import { TagChip } from "@/features/tags/components/tag-chip";
import {
  EMPTY_LABEL,
  fileTypeLabel,
  formatCalendarDate,
  formatInstantDate,
  formatRelativeDay,
} from "@/lib/format";

export type DocumentColumnKey =
  | "fileType"
  | "type"
  | "tags"
  | "location"
  | "documentDate"
  | "added";

type ColumnDef = {
  label: string;
  width: string;
  cellClassName: string;
  sortField?: string;
  defaultDir?: "asc" | "desc";
  render: (doc: DocumentRow) => ReactNode;
};

const COLUMNS: Record<DocumentColumnKey, ColumnDef> = {
  fileType: {
    label: "File type",
    width: "w-20",
    cellClassName: "truncate",
    render: (doc) => fileTypeLabel(doc.mimeType),
  },
  type: {
    label: "Document type",
    width: "w-32",
    cellClassName: "truncate",
    render: (doc) => doc.documentTypeName,
  },
  tags: {
    label: "Tags",
    width: "w-40",
    cellClassName: "flex items-center gap-1 overflow-hidden",
    render: (doc) =>
      doc.tags.length > 0 ? (
        <>
          {doc.tags.slice(0, MAX_ROW_TAGS).map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} className="max-w-full" />
          ))}
          {doc.tags.length > MAX_ROW_TAGS ? (
            <span className="shrink-0">+{doc.tags.length - MAX_ROW_TAGS}</span>
          ) : null}
        </>
      ) : null,
  },
  location: {
    label: "Storage path",
    width: "w-36",
    cellClassName: "truncate",
    render: (doc) => doc.storagePathName,
  },
  documentDate: {
    label: "Document date",
    width: "w-32",
    cellClassName: "truncate",
    sortField: "documentDate",
    defaultDir: "desc",
    render: (doc) => (doc.documentDate ? formatCalendarDate(doc.documentDate) : null),
  },
  added: {
    label: "Added",
    width: "w-28",
    cellClassName: "truncate",
    sortField: "created",
    defaultDir: "desc",
    render: (doc) => (
      <span title={`Added ${formatInstantDate(doc.createdAt)}`}>
        {formatRelativeDay(doc.createdAt)}
      </span>
    ),
  },
};

const MAX_ROW_TAGS = 2;

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

export function DocumentTable({
  orgId,
  documents,
  columns,
  folders,
  onOpenFolder,
  selection,
  sorting,
}: {
  orgId: string;
  documents: DocumentRow[];
  columns: DocumentColumnKey[];
  folders?: ReadonlyArray<FolderNode>;
  onOpenFolder?: (path: string) => void;
  selection?: {
    isSelected: (id: string) => boolean;
    onToggle: (id: string, shiftKey: boolean) => void;
    allChecked: boolean;
    onToggleAll: () => void;
  };
  sorting?: {
    sort: SortState;
    onSortChange: (sort: SortState) => void;
  };
}) {
  const cols = columns.map((key) => ({ key, ...COLUMNS[key] }));

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="w-fit min-w-full">
        <div className="flex items-center border-b text-muted-foreground text-xs">
          {selection ? (
            <span className="sticky left-0 z-10 flex items-center self-stretch bg-background py-2 pr-3 pl-4">
              <SelectCheckbox
                checked={selection.allChecked}
                onToggle={() => selection.onToggleAll()}
                label="Select all documents"
              />
            </span>
          ) : null}
          <div
            className={cn("flex min-w-0 flex-1 items-center gap-3 py-2 pr-4", !selection && "pl-4")}
          >
            <span aria-hidden className="w-4 shrink-0 max-sm:hidden" />
            <HeaderLabel
              label="Name"
              sortField="title"
              defaultDir="asc"
              sorting={sorting}
              className="min-w-48 flex-1"
            />
            {cols.map((col) => (
              <HeaderLabel
                key={col.key}
                label={col.label}
                sortField={col.sortField}
                defaultDir={col.defaultDir}
                sorting={sorting}
                className={cn("shrink-0 max-sm:hidden", col.width)}
              />
            ))}
          </div>
        </div>
        <ul className="divide-y">
          {folders?.map((folder) => (
            <li key={folder.path} className="group flex items-center hover:bg-accent">
              {selection ? (
                <span className="sticky left-0 z-10 flex items-center self-stretch bg-background pr-3 pl-4 group-hover:bg-accent">
                  <span aria-hidden className="w-4 shrink-0" />
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenFolder?.(folder.path)}
                title={folder.path}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pr-4 text-left",
                  !selection && "pl-4",
                )}
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground max-sm:hidden" />
                <span className="min-w-48 flex-1 truncate font-medium text-sm">{folder.name}</span>
                {cols.map((col) => (
                  <span
                    key={col.key}
                    className={cn(
                      "shrink-0 text-muted-foreground text-xs max-sm:hidden",
                      col.width,
                      col.cellClassName,
                    )}
                  >
                    <span aria-hidden>{EMPTY_LABEL}</span>
                  </span>
                ))}
              </button>
            </li>
          ))}
          {documents.map((doc) => {
            const Icon = fileTypeIcon(doc.mimeType);
            return (
              <li key={doc.id} className="group flex items-center hover:bg-accent">
                {selection ? (
                  <span className="sticky left-0 z-10 flex items-center self-stretch bg-background pr-3 pl-4 group-hover:bg-accent">
                    <SelectCheckbox
                      checked={selection.isSelected(doc.id)}
                      onToggle={(shiftKey) => selection.onToggle(doc.id, shiftKey)}
                      label={`Select ${doc.title}`}
                    />
                  </span>
                ) : null}
                <Link
                  to="/dashboard/orgs/$orgId/documents/$id"
                  params={{ orgId, id: doc.id }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4",
                    !selection && "pl-4",
                  )}
                >
                  <Icon className="size-4 shrink-0 max-sm:hidden" />
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <span className="min-w-0 truncate font-medium text-sm">{doc.title}</span>
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
                  </span>
                  {cols.map((col) => (
                    <span
                      key={col.key}
                      className={cn(
                        "shrink-0 text-muted-foreground text-xs tabular-nums max-sm:hidden",
                        col.width,
                        col.cellClassName,
                      )}
                    >
                      {col.render(doc) ?? <span aria-hidden>{EMPTY_LABEL}</span>}
                    </span>
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function HeaderLabel({
  label,
  sortField,
  defaultDir = "desc",
  sorting,
  className,
}: {
  label: string;
  sortField?: string;
  defaultDir?: "asc" | "desc";
  sorting?: { sort: SortState; onSortChange: (sort: SortState) => void };
  className?: string;
}) {
  if (!sorting || !sortField) {
    return <span className={className}>{label}</span>;
  }

  const active = sorting.sort.field === sortField;
  return (
    <button
      type="button"
      onClick={() =>
        sorting.onSortChange(
          active
            ? { field: sortField, dir: sorting.sort.dir === "asc" ? "desc" : "asc" }
            : { field: sortField, dir: defaultDir },
        )
      }
      className={cn(
        "flex cursor-pointer items-center gap-1 text-left transition-colors hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {active ? (
        sorting.sort.dir === "asc" ? (
          <ArrowUpIcon className="size-3 shrink-0" />
        ) : (
          <ArrowDownIcon className="size-3 shrink-0" />
        )
      ) : (
        <ChevronsUpDownIcon className="size-3 shrink-0 opacity-40" />
      )}
    </button>
  );
}
