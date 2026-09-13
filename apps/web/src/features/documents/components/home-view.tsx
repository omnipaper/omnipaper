import { cn } from "@omnipaper/ui/lib/utils";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClockIcon, FilesIcon, LayoutGridIcon, ListIcon } from "lucide-react";
import { PageLoader } from "@/components/page-loader";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { DocumentsEmptyState } from "@/features/documents/components/document-list";
import { DocumentSearchInput } from "@/features/documents/components/document-search-input";
import { DocumentTable } from "@/features/documents/components/document-table";
import { DocumentThumbnail } from "@/features/documents/components/document-thumbnail";
import { InfiniteScrollSentinel } from "@/features/documents/components/infinite-scroll-sentinel";
import { ActiveFilterChip } from "@/features/documents/filters/active-filter-chip";
import { AddFilterMenu } from "@/features/documents/filters/add-filter-menu";
import { useDocumentFilterFields } from "@/features/documents/filters/fields";
import { FilterFieldChip } from "@/features/documents/filters/filter-field-chip";
import type { DocumentView } from "@/features/documents/filters/types";
import { useDocumentFilters } from "@/features/documents/filters/use-document-filters";
import { useDocumentSearch } from "@/features/documents/filters/use-document-search";
import { type DocumentRow, documentsListQuery } from "@/features/documents/queries/documents";
import { TagChip } from "@/features/tags/components/tag-chip";
import { formatInstantDate, formatRelativeDay } from "@/lib/format";

export function HomeView({ orgId }: { orgId: string }) {
  const search = useDocumentSearch();
  const fields = useDocumentFilterFields(orgId);
  const { filters, view, setValue, remove, setView, clearAll } = useDocumentFilters();
  const userName = useQuery(sessionQueryOptions).data?.user?.name;

  const query = search.q ?? "";
  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(documentsListQuery({ orgId, query, filters }));

  const PINNED_FILTER_KEYS = ["documentType", "path", "tags", "createdAt"];
  const pinnedFields = fields.filter((f) => PINNED_FILTER_KEYS.includes(f.key));
  const menuFields = fields.filter((f) => !PINNED_FILTER_KEYS.includes(f.key));
  const menuFieldByKey = new Map(menuFields.map((f) => [f.key, f]));
  const activeEntries = Object.entries(filters);
  const documents = data?.pages.flatMap((p) => p.documents) ?? [];
  const hasCriteria = query.length > 0 || activeEntries.length > 0;

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 pt-12">
        <h1 className="font-bold text-3xl text-balance">Welcome{userName ? ` ${userName}` : ""}</h1>
        <DocumentSearchInput orgId={orgId} local className="h-12 w-full" />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {pinnedFields.map((field) => (
            <FilterFieldChip
              key={field.key}
              field={field}
              value={filters[field.key]}
              onChange={(next) => (next ? setValue(field.key, next) : remove(field.key))}
            />
          ))}
          {activeEntries.map(([key, value]) => {
            const field = menuFieldByKey.get(key);
            if (!field) {
              return null;
            }
            return (
              <ActiveFilterChip
                key={key}
                field={field}
                value={value}
                onChange={(next) => (next ? setValue(key, next) : remove(key))}
                onRemove={() => remove(key)}
              />
            );
          })}
          {menuFields.length > 0 ? (
            <AddFilterMenu
              fields={menuFields}
              filters={filters}
              onChange={(key, value) => (value ? setValue(key, value) : remove(key))}
            />
          ) : null}
          {activeEntries.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-muted-foreground text-sm">Recently added</h2>
          <ViewToggle view={view} onChange={setView} />
        </div>
        {isPending ? (
          <PageLoader />
        ) : isError ? (
          <p className="text-destructive">Failed to load documents.</p>
        ) : documents.length === 0 ? (
          <DocumentsEmptyState
            Icon={FilesIcon}
            title={hasCriteria ? "No matching documents" : "No documents yet"}
            hint={
              hasCriteria
                ? "Try adjusting your search or filters."
                : "Drag a file anywhere, or use the Upload button to add your first one."
            }
          />
        ) : (
          <>
            {view === "list" ? (
              <DocumentTable orgId={orgId} documents={documents} columns={["tags", "added"]} />
            ) : (
              <HomeCards orgId={orgId} documents={documents} />
            )}
            <InfiniteScrollSentinel
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

const VIEW_MODES = [
  { mode: "list", label: "List", icon: ListIcon },
  { mode: "gallery", label: "Gallery", icon: LayoutGridIcon },
] as const;

function ViewToggle({
  view,
  onChange,
}: {
  view: DocumentView;
  onChange: (view: DocumentView) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border p-0.5">
      {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          aria-pressed={view === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            view === mode
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function HomeCards({ orgId, documents }: { orgId: string; documents: DocumentRow[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            to="/dashboard/orgs/$orgId/documents/$id"
            params={{ orgId, id: doc.id }}
            className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-2 transition-colors hover:border-foreground/20"
          >
            <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-lg bg-muted">
              <DocumentThumbnail orgId={orgId} doc={doc} />
              {doc.tags.length > 0 ? (
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
            <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
              <span
                title={doc.title}
                className="truncate font-medium text-sm group-hover:underline"
              >
                {doc.title}
              </span>
              <span
                className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums"
                title={`Added ${formatInstantDate(doc.createdAt)}`}
              >
                <ClockIcon className="size-3 shrink-0" />
                {formatRelativeDay(doc.createdAt)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
