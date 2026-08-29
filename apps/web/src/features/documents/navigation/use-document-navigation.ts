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
  // False while the snapshot is still loading, or when this document is not part of it.
  known: boolean;
};

// Prev/next walk a SNAPSHOT of ids, never a live query, so editing a document out of the current
// filter cannot strand you mid-review. The snapshot comes from the session set when "Open" wrote
// one, otherwise it is fetched once for the last list search and then persisted to the same set,
// after which both flows behave identically (delete, reload). Collection pages clear the set.
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
