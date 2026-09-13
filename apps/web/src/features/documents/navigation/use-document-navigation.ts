import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getLastListSearch } from "@/features/documents/filters/last-list-search";
import {
  getNavigationSet,
  saveNavigationSet,
} from "@/features/documents/navigation/navigation-set";
import {
  documentDetailQuery,
  documentDownloadQuery,
  documentNavigationIdsQuery,
} from "@/features/documents/queries/documents";

export type DocumentNavigation = {
  previousId: string | null;
  nextId: string | null;
  known: boolean;
};

// Prev/next walk a snapshot of ids, not a live query, so editing a document out of the
// filter can't strand you mid-review.
export function useDocumentNavigation({
  orgId,
  id,
}: {
  orgId: string;
  id: string;
}): DocumentNavigation {
  const queryClient = useQueryClient();

  const stored = useMemo(() => getNavigationSet(orgId), [orgId, id]);
  const hasStored = stored.includes(id);
  const search = useMemo(() => getLastListSearch(orgId), [orgId]);

  const { data: fetched } = useQuery({
    ...documentNavigationIdsQuery({
      orgId,
      query: search.q ?? "",
      filters: search.filters,
      sort: search.sort,
    }),
    enabled: !hasStored,
  });

  useEffect(() => {
    if (!hasStored && fetched && fetched.includes(id)) {
      saveNavigationSet(orgId, fetched);
    }
  }, [hasStored, fetched, orgId, id]);

  const ids = hasStored ? stored : (fetched ?? []);
  const index = ids.indexOf(id);
  const known = index !== -1;
  const previousId = (known && index > 0 ? ids[index - 1] : null) ?? null;
  const nextId = (known ? ids[index + 1] : null) ?? null;

  useEffect(() => {
    if (!nextId) {
      return;
    }
    queryClient.prefetchQuery(documentDetailQuery({ orgId, id: nextId }));
    queryClient.prefetchQuery(documentDownloadQuery({ orgId, id: nextId }));
  }, [queryClient, orgId, nextId]);

  return { previousId, nextId, known };
}
