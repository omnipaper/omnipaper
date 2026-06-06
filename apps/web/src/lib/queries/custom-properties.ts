import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + query factory for the custom-properties domain (org-scoped). Hierarchical
// keys so reads and invalidations share one source.
export const customPropertyKeys = {
  root: ["custom-properties"] as const,
  all: (orgId: string) => [...customPropertyKeys.root, orgId] as const,
  lists: (orgId: string) => [...customPropertyKeys.all(orgId), "list"] as const,
};

export function orgPropertyDefinitionsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: customPropertyKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["custom-properties"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load properties");
      }
      return res.json();
    },
  });
}
