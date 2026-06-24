import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const workflowKeys = {
  root: ["workflows"] as const,
  all: (orgId: string) => [...workflowKeys.root, orgId] as const,
  lists: (orgId: string) => [...workflowKeys.all(orgId), "list"] as const,
};

export function orgWorkflowsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: workflowKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].workflows.$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load workflows");
      }
      return res.json();
    },
  });
}

export type Workflow = InferResponseType<
  (typeof api.orgs)[":orgId"]["workflows"]["$get"],
  200
>["workflows"][number];

export type CreateWorkflowBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["workflows"]["$post"]
>["json"];

type UpdateWorkflowBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["workflows"][":id"]["$patch"]
>["json"];

export function useCreateWorkflow(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWorkflowBody) => {
      const res = await api.orgs[":orgId"].workflows.$post({ param: { orgId }, json: body });
      if (!res.ok) {
        throw new Error("Failed to create workflow");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(orgId) });
      toast.success("Workflow created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateWorkflow(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; body: UpdateWorkflowBody }) => {
      const res = await api.orgs[":orgId"].workflows[":id"].$patch({
        param: { orgId, id: vars.id },
        json: vars.body,
      });
      if (!res.ok) {
        throw new Error("Failed to update workflow");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useDeleteWorkflow(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].workflows[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to delete workflow");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists(orgId) });
      toast.success("Workflow deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}
