import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";

// Query-key factory + query/mutation factories for the custom-properties domain (org-scoped).
// Hierarchical keys so reads and invalidations share one source. Mutations live beside the reads so
// each write owns its own invalidation.
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

export type UpsertPropertyDefinitionInput = {
  id?: string;
  name: string;
  type: "text" | "url" | "number" | "date" | "boolean" | "select";
  description: string | null;
  options?: { label: string; color: string }[];
};

// Create or update a property definition from the manager dialog. A rename only touches the catalog
// query; documents read property names from it, so no need to refetch every document here (delete
// handles that separately).
export function useUpsertPropertyDefinition(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertPropertyDefinitionInput) => {
      const res = input.id
        ? await api.orgs[":orgId"]["custom-properties"][":id"].$patch({
            param: { orgId, id: input.id },
            json: { name: input.name, description: input.description },
          })
        : await api.orgs[":orgId"]["custom-properties"].$post({
            param: { orgId },
            json: {
              name: input.name,
              type: input.type,
              description: input.description ?? undefined,
              options: input.type === "select" ? input.options : undefined,
            },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A property with this name already exists"
            : input.id
              ? "Failed to update property"
              : "Failed to create property",
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
      toast.success(input.id ? "Property updated" : "Property created");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Delete a property definition. Removes the property and its value from every document it was on,
// so refresh the document views too.
export function useDeletePropertyDefinition(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete property");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Property deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

// Add a select option to an existing property definition. Only the catalog query changes; the new
// option isn't on any document yet.
export function useAddPropertyOption(orgId: string, definitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { label: string; color: string }) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options.$post({
        param: { orgId, id: definitionId },
        json: { label: vars.label, color: vars.color },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "An option with this label already exists" : "Failed to add option",
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}

// Remove a select option from a property definition. The option is removed from any document using
// it, so refresh the document views too.
export function useDeletePropertyOption(orgId: string, definitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (optionId: string) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options[":optionId"].$delete(
        {
          param: { orgId, id: definitionId, optionId },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to remove option");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
