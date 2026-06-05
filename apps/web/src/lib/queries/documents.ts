import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

type DocumentRef = { orgId: string; id: string };

// Query-key factory for the documents domain. Keys are hierarchical (generic → specific) so we
// can invalidate at any level: every doc query for an org, just the lists, or a single detail.
// Reads and invalidations both go through here, so a key can never drift between the two sides.
export const documentKeys = {
  root: ["documents"] as const,
  all: (orgId: string) => [...documentKeys.root, orgId] as const,
  lists: (orgId: string) => [...documentKeys.all(orgId), "list"] as const,
  list: ({ orgId, query }: { orgId: string; query: string }) =>
    [...documentKeys.lists(orgId), { query }] as const,
  details: (orgId: string) => [...documentKeys.all(orgId), "detail"] as const,
  detail: ({ orgId, id }: DocumentRef) => [...documentKeys.details(orgId), id] as const,
  activity: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "activity"] as const,
};

export function documentsListQuery({ orgId, query = "" }: { orgId: string; query?: string }) {
  return queryOptions({
    queryKey: documentKeys.list({ orgId, query }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents.$get({
        param: { orgId },
        query: query ? { q: query } : {},
      });
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      return res.json();
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
