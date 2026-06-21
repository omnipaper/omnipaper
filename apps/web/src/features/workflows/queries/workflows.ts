import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Org-scoped query keys for the automation/workflows domain (mirrors the custom-properties factory).
export const workflowKeys = {
  root: ["workflows"] as const,
  all: (orgId: string) => [...workflowKeys.root, orgId] as const,
  lists: (orgId: string) => [...workflowKeys.all(orgId), "list"] as const,
  system: (orgId: string) => [...workflowKeys.all(orgId), "system"] as const,
};

export type SystemWorkflow = InferResponseType<
  (typeof api.orgs)[":orgId"]["workflows"]["system"]["$get"],
  200
>["workflow"];

// The single system workflow whose AI field config the front-door toggles edit (null until first save).
export function systemWorkflowQuery(orgId: string) {
  return queryOptions({
    queryKey: workflowKeys.system(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].workflows.system.$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load automation settings");
      }
      return res.json();
    },
  });
}

export type SaveAutomationInput = InferRequestType<
  (typeof api.orgs)[":orgId"]["workflows"]["system"]["$put"]
>["json"];

export function useSaveAutomationSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAutomationInput) => {
      const res = await api.orgs[":orgId"].workflows.system.$put({ param: { orgId }, json: input });
      if (!res.ok) {
        throw new Error("Failed to save automation settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.system(orgId) });
      toast.success("Automation settings saved");
    },
    onError: () => toast.error("Save failed"),
  });
}
