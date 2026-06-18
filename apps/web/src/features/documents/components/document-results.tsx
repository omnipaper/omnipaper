import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { DocumentCards } from "@/features/documents/components/document-cards";
import { DocumentRows } from "@/features/documents/components/document-rows";
import type { DocumentSearch } from "@/features/documents/filters/types";
import { documentsListQuery } from "@/features/documents/queries/documents";

// Pure renderer over the shared query: paged fetch flattened into one list, then list or gallery by
// `view`. Folder scope, filters, search and sort all arrive through the URL (filters.path carries the
// folder), so every layout sees the same result set — no per-view query, no duplicated handling.
export function DocumentResults({ orgId }: { orgId: string }) {
  const search = useSearch({ strict: false }) as DocumentSearch;
  const view = search.view ?? "gallery";
  const query = search.q ?? "";
  const filters = search.filters ?? {};
  const sort = search.sort;

  const { data, isPending, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(documentsListQuery({ orgId, query, filters, sort }));

  // Infinite scroll: fetch the next page when a bottom sentinel scrolls near the viewport.
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
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (isError) {
    return <p className="text-destructive">Failed to load documents.</p>;
  }

  const documents = data?.pages.flatMap((p) => p.documents) ?? [];
  const hasCriteria = query.length > 0 || Object.keys(filters).length > 0;

  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground">
        {hasCriteria ? "No documents match your filters." : "No documents yet. Upload one above."}
      </p>
    );
  }

  return (
    <>
      {view === "list" ? (
        <DocumentRows orgId={orgId} documents={documents} />
      ) : (
        <DocumentCards orgId={orgId} documents={documents} />
      )}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {isFetchingNextPage ? (
        <p className="mt-4 text-center text-muted-foreground text-sm">Loading more…</p>
      ) : null}
    </>
  );
}
