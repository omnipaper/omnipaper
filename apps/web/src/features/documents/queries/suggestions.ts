import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

export type DocumentSuggestion = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["suggestions"]["$get"],
  200
>["suggestions"][number];

const suggestionKeys = {
  forDocument: (orgId: string, documentId: string) =>
    ["document-suggestions", orgId, documentId] as const,
};

export function documentSuggestionsQuery({
  orgId,
  documentId,
}: {
  orgId: string;
  documentId: string;
}) {
  return queryOptions({
    queryKey: suggestionKeys.forDocument(orgId, documentId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].suggestions.$get({
        param: { orgId, id: documentId },
      });
      if (!res.ok) {
        throw new Error("Failed to load suggestions");
      }
      return res.json();
    },
  });
}

export function useAcceptSuggestion(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await api.orgs[":orgId"].documents[":id"].suggestions[
        ":suggestionId"
      ].accept.$post({ param: { orgId, id: documentId, suggestionId } });
      if (!res.ok) {
        throw new Error("Failed to apply suggestion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionKeys.forDocument(orgId, documentId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail({ orgId, id: documentId }) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Suggestion applied");
    },
    onError: () => toast.error("Failed to apply suggestion"),
  });
}

export function useDismissSuggestion(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await api.orgs[":orgId"].documents[":id"].suggestions[
        ":suggestionId"
      ].dismiss.$post({ param: { orgId, id: documentId, suggestionId } });
      if (!res.ok) {
        throw new Error("Failed to dismiss suggestion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionKeys.forDocument(orgId, documentId) });
    },
    onError: () => toast.error("Failed to dismiss suggestion"),
  });
}
