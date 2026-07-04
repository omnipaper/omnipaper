import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

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

export type OrgDocumentType = InferResponseType<
  (typeof api.orgs)[":orgId"]["document-types"]["$get"],
  200
>["documentTypes"][number];

type UpdateDocumentTypeBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["document-types"][":id"]["$patch"]
>["json"];

export type UpsertDocumentTypeInput = {
  id?: string;
  name: NonNullable<UpdateDocumentTypeBody["name"]>;
  description: UpdateDocumentTypeBody["description"];
};

export function useUpsertDocumentType(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertDocumentTypeInput) => {
      const res = input.id
        ? await api.orgs[":orgId"]["document-types"][":id"].$patch({
            param: { orgId, id: input.id },
            json: { name: input.name, description: input.description },
          })
        : await api.orgs[":orgId"]["document-types"].$post({
            param: { orgId },
            json: { name: input.name, description: input.description ?? undefined },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A document type with this name already exists"
            : input.id
              ? "Failed to update document type"
              : "Failed to create document type",
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
      if (input.id) {
        queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      }
      toast.success(input.id ? "Document type updated" : "Document type created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useSetDocumentTypeAiEligible(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aiEligible }: { id: string; aiEligible: boolean }) => {
      const res = await api.orgs[":orgId"]["document-types"][":id"].$patch({
        param: { orgId, id },
        json: { aiEligible },
      });
      if (!res.ok) {
        throw new Error("Failed to update document type");
      }
    },
    onMutate: async ({ id, aiEligible }) => {
      await queryClient.cancelQueries({ queryKey: documentTypeKeys.lists(orgId) });
      const previous = queryClient.getQueryData<{ documentTypes: OrgDocumentType[] }>(
        documentTypeKeys.lists(orgId),
      );
      queryClient.setQueryData<{ documentTypes: OrgDocumentType[] }>(
        documentTypeKeys.lists(orgId),
        (old) =>
          old
            ? {
                ...old,
                documentTypes: old.documentTypes.map((t) =>
                  t.id === id ? { ...t, aiEligible } : t,
                ),
              }
            : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(documentTypeKeys.lists(orgId), context.previous);
      }
      toast.error("Failed to update document type");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
    },
  });
}

export function useDeleteDocumentType(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["document-types"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete document type");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Document type deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCreateDocumentType(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.orgs[":orgId"]["document-types"].$post({
        param: { orgId },
        json: { name },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A document type with this name already exists"
            : "Failed to create document type",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
