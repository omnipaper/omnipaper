import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

type DocumentRef = { orgId: string; id: string };

// Filters for the documents list, shared by the list view (`query`) and the folder views
// (`storagePathId` for one path, `unfiled` for documents with none). All optional.
type DocumentListFilters = {
  orgId: string;
  query?: string;
  storagePathId?: string;
  unfiled?: boolean;
};

// Query-key factory for the documents domain. Keys are hierarchical (generic → specific) so we
// can invalidate at any level: every doc query for an org, just the lists, or a single detail.
// Reads and invalidations both go through here, so a key can never drift between the two sides.
export const documentKeys = {
  root: ["documents"] as const,
  all: (orgId: string) => [...documentKeys.root, orgId] as const,
  lists: (orgId: string) => [...documentKeys.all(orgId), "list"] as const,
  list: ({ orgId, query = "", storagePathId, unfiled }: DocumentListFilters) =>
    [...documentKeys.lists(orgId), { query, storagePathId, unfiled }] as const,
  details: (orgId: string) => [...documentKeys.all(orgId), "detail"] as const,
  detail: ({ orgId, id }: DocumentRef) => [...documentKeys.details(orgId), id] as const,
  activity: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "activity"] as const,
  download: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "download"] as const,
};

export function documentsListQuery({
  orgId,
  query = "",
  storagePathId,
  unfiled,
}: DocumentListFilters) {
  return queryOptions({
    queryKey: documentKeys.list({ orgId, query, storagePathId, unfiled }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents.$get({
        param: { orgId },
        query: {
          ...(query ? { q: query } : {}),
          ...(storagePathId ? { storagePathId } : {}),
          ...(unfiled ? { unfiled: "true" as const } : {}),
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      return res.json();
    },
    // Mirror the detail query's polling so a freshly uploaded document's OCR progress
    // (pending → processing → completed/failed) lands on the list without a manual refresh.
    // Poll only while *some* document is still in flight; once every row has settled the
    // interval returns false and network traffic drops back to zero.
    refetchInterval: (query) => {
      const documents = query.state.data?.documents ?? [];
      const inFlight = documents.some(
        (d) => d.ocrStatus === "pending" || d.ocrStatus === "processing",
      );
      return inFlight ? 3000 : false;
    },
  });
}

export function documentDetailQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.detail({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Document not found");
      }
      return res.json();
    },
    // While OCR is in flight, poll so a re-run's progress (pending → processing → completed/failed)
    // lands without a manual refresh. Polling stops once the status settles.
    refetchInterval: (query) => {
      const status = query.state.data?.document.ocrStatus;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function documentDownloadQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.download({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].download.$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to prepare preview");
      }
      return res.json();
    },
    // The /download route signs the URL for 1h; staying fresh for most of that window means a
    // normal viewing session reuses one URL (no re-download), while a long-open page still
    // refetches a new URL on the next focus/remount, well before the 1h expiry.
    staleTime: 50 * 60 * 1000,
  });
}

export function documentActivityQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.activity({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].activity.$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to load activity");
      }
      return res.json();
    },
  });
}
