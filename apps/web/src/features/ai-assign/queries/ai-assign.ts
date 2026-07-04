import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const aiAssignKeys = {
  root: ["ai-assign"] as const,
  all: (orgId: string) => [...aiAssignKeys.root, orgId] as const,
};

export function aiAssignQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: aiAssignKeys.all(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["ai-assign"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load AI assignment settings");
      }
      return res.json();
    },
  });
}

export type AiAssignConfig = InferResponseType<
  (typeof api.orgs)[":orgId"]["ai-assign"]["$get"],
  200
>;
export type AiAssignField = keyof AiAssignConfig["fields"];

type PatchBody = InferRequestType<(typeof api.orgs)[":orgId"]["ai-assign"]["$patch"]>["json"];

export function useSetAiAssignField(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PatchBody) => {
      const res = await api.orgs[":orgId"]["ai-assign"].$patch({ param: { orgId }, json: input });
      if (!res.ok) {
        throw new Error("Failed to update AI settings");
      }
      return res.json();
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: aiAssignKeys.all(orgId) });
      const previous = queryClient.getQueryData<AiAssignConfig>(aiAssignKeys.all(orgId));
      if (previous) {
        let next: AiAssignConfig;
        if (input.field === "customProperty") {
          const entries = previous.customFields.filter(
            (e) => e.definitionId !== input.definitionId,
          );
          if (input.enabled) {
            entries.push({
              definitionId: input.definitionId,
              mode: "suggest",
              allowNew: false,
            });
          }
          next = { ...previous, customFields: entries };
        } else {
          const current = previous.fields[input.field];
          next = {
            ...previous,
            fields: {
              ...previous.fields,
              [input.field]: {
                ...current,
                enabled: input.enabled,
                mode: input.mode ?? current.mode,
                ...(input.allowNew !== undefined ? { allowNew: input.allowNew } : {}),
              },
            },
          } as AiAssignConfig;
        }
        queryClient.setQueryData(aiAssignKeys.all(orgId), next);
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(aiAssignKeys.all(orgId), context.previous);
      }
      toast.error("Save failed");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(aiAssignKeys.all(orgId), data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: aiAssignKeys.all(orgId) });
    },
  });
}
