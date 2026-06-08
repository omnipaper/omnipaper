import { api } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";

// Query-key factory + query for the document-types taxonomy. Org-scoped; mirrors tagKeys.
export const documentTypeKeys = {
  root: ["document-types"] as const,
  all: (orgId: string) => [...documentTypeKeys.root, orgId] as const,
  lists: (orgId: string) => [...documentTypeKeys.all(orgId), "list"] as const,
};

export function orgDocumentTypesQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: documentTypeKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["document-types"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load document types");
      }
      return res.json();
    },
  });
}
