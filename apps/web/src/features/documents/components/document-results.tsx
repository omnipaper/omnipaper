import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { FilesIcon, Loader2Icon, SearchXIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { PageLoader } from "@/components/page-loader";
import { DocumentCards } from "@/features/documents/components/document-cards";
import { DocumentRows } from "@/features/documents/components/document-rows";
import type { DocumentSearch } from "@/features/documents/filters/types";
import { documentsListQuery } from "@/features/documents/queries/documents";
import { useDocumentSelection } from "@/features/documents/selection/use-document-selection";

export function DocumentResults({ orgId }: { orgId: string }) {
  const search = useSearch({ strict: false }) as DocumentSearch;
  const view = search.view ?? "gallery";
  const query = search.q ?? "";
  const filters = search.filters ?? {};
  const sort = search.sort;

  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(documentsListQuery({ orgId, query, filters, sort }));

  const selection = useDocumentSelection();

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return <PageLoader />;
  }
  if (isError) {
    return <p className="text-destructive">Failed to load documents.</p>;
  }

  const documents = data?.pages.flatMap((p) => p.documents) ?? [];
  const hasCriteria = query.length > 0 || Object.keys(filters).length > 0;

  if (documents.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {hasCriteria ? <SearchXIcon className="size-6" /> : <FilesIcon className="size-6" />}
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">
            {hasCriteria ? "No matching documents" : "No documents yet"}
          </p>
          <p className="max-w-xs text-muted-foreground text-sm">
            {hasCriteria
              ? "Try adjusting your search or filters."
              : "Drag a file anywhere, or use the Upload button to add your first one."}
          </p>
        </div>
      </div>
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
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {isFetchingNextPage ? (
        <div className="py-6 flex justify-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground/50" />
        </div>
      ) : null}
    </>
  );
}
