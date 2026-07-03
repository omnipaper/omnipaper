import type { SavedViewState } from "@omnipaper/shared/saved-views";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Query-key factory + query/mutation factories for saved views. Org-scoped; mirrors tagKeys. Each
// write owns its own list invalidation.
export const savedViewKeys = {
  root: ["saved-views"] as const,
  all: (orgId: string) => [...savedViewKeys.root, orgId] as const,
  lists: (orgId: string) => [...savedViewKeys.all(orgId), "list"] as const,
};

export function orgSavedViewsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: savedViewKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["saved-views"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load saved views");
      }
      return res.json();
    },
  });
}

export type OrgSavedView = InferResponseType<
  (typeof api.orgs)[":orgId"]["saved-views"]["$get"],
  200
>["savedViews"][number];

export function useCreateSavedView(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; state: SavedViewState }) => {
      const res = await api.orgs[":orgId"]["saved-views"].$post({
        param: { orgId },
        json: input,
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A view with this name already exists" : "Failed to save view",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists(orgId) });
      toast.success("View saved");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateSavedView(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; state?: SavedViewState }) => {
      const { id, ...patch } = input;
      const res = await api.orgs[":orgId"]["saved-views"][":id"].$patch({
        param: { orgId, id },
        json: patch,
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A view with this name already exists" : "Failed to update view",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useDeleteSavedView(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["saved-views"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete view");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.lists(orgId) });
      toast.success("View deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}
