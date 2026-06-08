import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

// Query-key factory + query/mutation factories for the tags domain. Hierarchical keys
// (generic → specific) so reads and invalidations share one source and can't drift. Tags are
// org-scoped. Mutations live beside the reads so each write owns its own invalidation.
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

export type UpsertTagInput = {
  id?: string;
  name: string;
  color: string;
  description: string | null;
};

// Create or update a tag from the manager dialog. A rename/recolor changes how the tag renders on
// documents, so an update also refreshes the document views; a create doesn't touch any document.
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

// Delete a tag. Removes it from every document it was on, so refresh the document views too.
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

// Quick-create a tag by name only (the tag picker's inline "Create …"). The server assigns a
// default colour. Returns the created tag so the caller can immediately attach it to a document.
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
