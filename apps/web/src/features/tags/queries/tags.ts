import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

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

export type OrgTag = InferResponseType<
  (typeof api.orgs)[":orgId"]["tags"]["$get"],
  200
>["tags"][number];

type UpdateTagBody = InferRequestType<(typeof api.orgs)[":orgId"]["tags"][":id"]["$patch"]>["json"];

export type UpsertTagInput = {
  id?: string;
  name: NonNullable<UpdateTagBody["name"]>;
  color: NonNullable<UpdateTagBody["color"]>;
  description: UpdateTagBody["description"];
};

export function useUpsertTag(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTagInput) => {
      const res = input.id
        ? await api.orgs[":orgId"].tags[":id"].$patch({
            param: { orgId, id: input.id },
            json: { name: input.name, color: input.color, description: input.description },
          })
        : await api.orgs[":orgId"].tags.$post({
            param: { orgId },
            json: {
              name: input.name,
              color: input.color,
              description: input.description ?? undefined,
            },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A tag with this name already exists"
            : input.id
              ? "Failed to update tag"
              : "Failed to create tag",
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
      if (input.id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      }
      toast.success(input.id ? "Tag updated" : "Tag created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useSetTagAiEligible(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aiEligible }: { id: string; aiEligible: boolean }) => {
      const res = await api.orgs[":orgId"].tags[":id"].$patch({
        param: { orgId, id },
        json: { aiEligible },
      });
      if (!res.ok) {
        throw new Error("Failed to update tag");
      }
    },
    onMutate: async ({ id, aiEligible }) => {
      await queryClient.cancelQueries({ queryKey: tagKeys.lists(orgId) });
      const previous = queryClient.getQueryData<{ tags: OrgTag[] }>(tagKeys.lists(orgId));
      queryClient.setQueryData<{ tags: OrgTag[] }>(tagKeys.lists(orgId), (old) =>
        old ? { ...old, tags: old.tags.map((t) => (t.id === id ? { ...t, aiEligible } : t)) } : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tagKeys.lists(orgId), context.previous);
      }
      toast.error("Failed to update tag");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
    },
  });
}

export function useDeleteTag(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].tags[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to delete tag");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Tag deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCreateTag(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.orgs[":orgId"].tags.$post({ param: { orgId }, json: { name } });
      if (!res.ok) {
        throw new Error("Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
    },
    onError: () => toast.error("Failed to create tag"),
  });
}
