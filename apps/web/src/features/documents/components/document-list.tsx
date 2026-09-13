import type { FolderNode } from "@omnipaper/shared/storage-paths";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FilesIcon, SearchXIcon } from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useMemo } from "react";
import { PageLoader } from "@/components/page-loader";
import { DocumentCards } from "@/features/documents/components/document-cards";
import { DocumentRows } from "@/features/documents/components/document-rows";
import { InfiniteScrollSentinel } from "@/features/documents/components/infinite-scroll-sentinel";
import type { FilterState } from "@/features/documents/filters/types";
import { useDocumentSearch } from "@/features/documents/filters/use-document-search";
import { documentsListQuery } from "@/features/documents/queries/documents";
import { useDocumentSelection } from "@/features/documents/selection/use-document-selection";

export function DocumentList({
  orgId,
  filters,
  enabled = true,
  folders,
  onOpenFolder,
  empty,
}: {
  orgId: string;
  filters?: FilterState;
  enabled?: boolean;
  folders?: ReadonlyArray<FolderNode>;
  onOpenFolder?: (path: string) => void;
  empty?: (ctx: { hasCriteria: boolean }) => ReactNode;
}) {
  const search = useDocumentSearch();
  const view = search.view ?? "gallery";
  const query = search.q ?? "";
  const urlFilters = search.filters ?? {};
  const sort = search.sort;

  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      ...documentsListQuery({ orgId, query, filters: filters ?? urlFilters, sort }),
      enabled,
    });

  const selection = useDocumentSelection();
  const documents = useMemo(
    () => (enabled ? (data?.pages.flatMap((p) => p.documents) ?? []) : []),
    [enabled, data],
  );
  useEffect(() => {
    selection.registerOrder(documents.map((d) => d.id));
  }, [documents, selection.registerOrder]);

  if (enabled && isPending) {
    return <PageLoader />;
  }
  if (isError) {
    return <p className="text-destructive">Failed to load documents.</p>;
  }

  const hasCriteria = query.length > 0 || Object.keys(urlFilters).length > 0;

  const folderRowsVisible = view === "list" && folders !== undefined && folders.length > 0;
  if (documents.length === 0 && !folderRowsVisible) {
    if (empty) {
      return <>{empty({ hasCriteria })}</>;
    }
    return hasCriteria ? (
      <DocumentsEmptyState
        Icon={SearchXIcon}
        title="No matching documents"
        hint="Try adjusting your search or filters."
      />
    ) : (
      <DocumentsEmptyState
        Icon={FilesIcon}
        title="No documents yet"
        hint="Drag a file anywhere, or use the Upload button to add your first one."
      />
    );
  }

  const orderedIds = documents.map((d) => d.id);
  const onToggle = (id: string, shiftKey: boolean) => selection.toggle(id, orderedIds, shiftKey);

  return (
    <>
      {view === "list" ? (
        <DocumentRows
          orgId={orgId}
          documents={documents}
          folders={folders}
          onOpenFolder={onOpenFolder}
          isSelected={selection.isSelected}
          onToggle={onToggle}
        />
      ) : (
        <DocumentCards
          orgId={orgId}
          documents={documents}
          isSelected={selection.isSelected}
          onToggle={onToggle}
        />
      )}
      <InfiniteScrollSentinel
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </>
  );
}

export function DocumentsEmptyState({
  Icon,
  title,
  hint,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-xs text-muted-foreground text-sm">{hint}</p>
      </div>
    </div>
  );
}
