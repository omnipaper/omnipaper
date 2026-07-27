import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getLastListSearch } from "@/features/documents/filters/last-list-search";
import {
  documentDetailQuery,
  documentDownloadQuery,
  documentsListQuery,
} from "@/features/documents/queries/documents";

const PREFETCH_MARGIN = 3;

type DocumentNavigation = {
  previousId: string | null;
  nextId: string | null;
};

export function useDocumentNavigation({
  orgId,
  id,
}: {
  orgId: string;
  id: string;
}): DocumentNavigation {
  const queryClient = useQueryClient();
  const search = useMemo(() => getLastListSearch(orgId), [orgId]);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    ...documentsListQuery({
      orgId,
      query: search.q ?? "",
      filters: search.filters,
      sort: search.sort,
    }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  const ids = useMemo(
    () => data?.pages.flatMap((page) => page.documents.map((document) => document.id)) ?? [],
    [data],
  );
  const index = ids.indexOf(id);
  const isKnown = index !== -1;

  useEffect(() => {
    if (isKnown && index >= ids.length - PREFETCH_MARGIN && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isKnown, index, ids.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const previousId = (isKnown && index > 0 ? ids[index - 1] : null) ?? null;
  const nextId = (isKnown ? ids[index + 1] : null) ?? null;

  useEffect(() => {
    if (!nextId) {
      return;
    }
    queryClient.prefetchQuery(documentDetailQuery({ orgId, id: nextId }));
    queryClient.prefetchQuery(documentDownloadQuery({ orgId, id: nextId }));
  }, [queryClient, orgId, nextId]);

  return { previousId, nextId };
}
