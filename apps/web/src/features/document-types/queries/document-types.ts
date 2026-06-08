import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
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

export type UpsertDocumentTypeInput = {
  // Present → update that type; absent → create a new one.
  id?: string;
  name: string;
  description: string | null;
};

// Create or update a document type from the manager dialog. Renaming changes how the type renders on
// documents, so an update also refreshes the document views; a create doesn't touch any document.
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

// Delete a document type. Un-types every document it was on, so refresh the document views too.
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

// Quick-create from the document metadata panel's "Create …" row. Returns the created type so the
// caller can immediately assign it to the document (no success toast — the caller chains a patch).
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
