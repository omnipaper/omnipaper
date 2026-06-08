import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + query for the storage-paths taxonomy. Org-scoped; mirrors tagKeys.
export const storagePathKeys = {
  root: ["storage-paths"] as const,
  all: (orgId: string) => [...storagePathKeys.root, orgId] as const,
  lists: (orgId: string) => [...storagePathKeys.all(orgId), "list"] as const,
};

export function orgStoragePathsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: storagePathKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["storage-paths"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load storage paths");
      }
      return res.json();
    },
  });
}
