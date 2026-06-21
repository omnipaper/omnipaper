import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

// Query-key factory + query/mutation factories for the storage-paths taxonomy. Org-scoped; mirrors
// tagKeys. Mutations live beside the read so each write owns its own invalidation.
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

export type OrgStoragePath = InferResponseType<
  (typeof api.orgs)[":orgId"]["storage-paths"]["$get"],
  200
>["storagePaths"][number];

type UpdateStoragePathBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["storage-paths"][":id"]["$patch"]
>["json"];

export type UpsertStoragePathInput = {
  // Present → update that path; absent → create a new one.
  id?: string;
  path: NonNullable<UpdateStoragePathBody["path"]>;
  description: UpdateStoragePathBody["description"];
};

// Create or update a storage path from the manager dialog. Renaming changes how the path renders on
// documents filed there, so an update also refreshes the document views; a create doesn't.
export function useUpsertStoragePath(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertStoragePathInput) => {
      const res = input.id
        ? await api.orgs[":orgId"]["storage-paths"][":id"].$patch({
            param: { orgId, id: input.id },
            json: { path: input.path, description: input.description },
          })
        : await api.orgs[":orgId"]["storage-paths"].$post({
            param: { orgId },
            json: { path: input.path, description: input.description ?? undefined },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "Invalid path, or a storage path with this value already exists"
            : input.id
              ? "Failed to update storage path"
              : "Failed to create storage path",
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: storagePathKeys.lists(orgId) });
      if (input.id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      }
      toast.success(input.id ? "Storage path updated" : "Storage path created");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Delete a storage path. Un-files every document filed there, so refresh the document views too.
export function useDeleteStoragePath(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["storage-paths"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete storage path");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storagePathKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Storage path deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Quick-create from the document metadata panel's "Create …" row. Returns the created path so the
// caller can immediately assign it to the document (no success toast — the caller chains a patch).
export function useCreateStoragePath(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const res = await api.orgs[":orgId"]["storage-paths"].$post({
        param: { orgId },
        json: { path },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "Invalid path, or a storage path with this value already exists"
            : "Failed to create storage path",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storagePathKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
