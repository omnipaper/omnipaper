import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + query factory for the tags domain. Hierarchical keys (generic → specific)
// so reads and invalidations share one source and can't drift. Tags are org-scoped.
export const tagKeys = {
  root: ["tags"] as const,
  all: (orgId: string) => [...tagKeys.root, orgId] as const,
  lists: (orgId: string) => [...tagKeys.all(orgId), "list"] as const,
};

export function orgTagsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: tagKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].tags.$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load tags");
      }
      return res.json();
    },
  });
}
