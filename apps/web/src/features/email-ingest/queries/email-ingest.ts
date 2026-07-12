import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const emailIngestKeys = {
  root: ["email-ingest"] as const,
  all: (orgId: string) => [...emailIngestKeys.root, orgId] as const,
  lists: (orgId: string) => [...emailIngestKeys.all(orgId), "list"] as const,
  processed: (orgId: string, accountId: string) =>
    [...emailIngestKeys.all(orgId), "processed", accountId] as const,
};

export function emailIngestAccountsQuery({ orgId }: { orgId: string }) {
  return queryOptions({
    queryKey: emailIngestKeys.lists(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["email-ingest"].$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load email accounts");
      }
      return res.json();
    },
  });
}

export type EmailIngestAccount = InferResponseType<
  (typeof api.orgs)[":orgId"]["email-ingest"]["$get"],
  200
>["accounts"][number];

export function emailIngestProcessedQuery({
  orgId,
  accountId,
}: {
  orgId: string;
  accountId: string;
}) {
  return queryOptions({
    queryKey: emailIngestKeys.processed(orgId, accountId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"]["email-ingest"][":id"].processed.$get({
        param: { orgId, id: accountId },
      });
      if (!res.ok) {
        throw new Error("Failed to load processed emails");
      }
      return res.json();
    },
  });
}

type CreateAccountBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["email-ingest"]["$post"]
>["json"];

export type UpsertEmailIngestAccountInput = CreateAccountBody & { id?: string };

export function useUpsertEmailIngestAccount(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpsertEmailIngestAccountInput) => {
      const res = id
        ? await api.orgs[":orgId"]["email-ingest"][":id"].$patch({
            param: { orgId, id },
            // The password field round-trips SECRET_MASK when untouched; the server keeps the
            // stored one (same convention as the OCR/AI/storage key forms).
            json: body,
          })
        : await api.orgs[":orgId"]["email-ingest"].$post({ param: { orgId }, json: body });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "An account with this label already exists"
            : id
              ? "Failed to update email account"
              : "Failed to create email account",
        );
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: emailIngestKeys.lists(orgId) });
      toast.success(input.id ? "Email account updated" : "Email account created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useSetEmailIngestAccountEnabled(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await api.orgs[":orgId"]["email-ingest"][":id"].$patch({
        param: { orgId, id },
        json: { enabled },
      });
      if (!res.ok) {
        throw new Error("Failed to update email account");
      }
    },
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: emailIngestKeys.lists(orgId) });
      const previous = queryClient.getQueryData<{ accounts: EmailIngestAccount[] }>(
        emailIngestKeys.lists(orgId),
      );
      queryClient.setQueryData<{ accounts: EmailIngestAccount[] }>(
        emailIngestKeys.lists(orgId),
        (old) =>
          old
            ? { ...old, accounts: old.accounts.map((a) => (a.id === id ? { ...a, enabled } : a)) }
            : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(emailIngestKeys.lists(orgId), context.previous);
      }
      toast.error("Failed to update email account");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emailIngestKeys.lists(orgId) });
    },
  });
}

export function useDeleteEmailIngestAccount(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["email-ingest"][":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to delete email account");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailIngestKeys.lists(orgId) });
      toast.success("Email account deleted");
    },
    onError: (error) => toast.error(error.message),
  });
}

type TestConnectionBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["email-ingest"]["test"]["$post"]
>["json"];

export function useTestEmailIngestConnection(orgId: string) {
  return useMutation({
    mutationFn: async (body: TestConnectionBody) => {
      const res = await api.orgs[":orgId"]["email-ingest"].test.$post({
        param: { orgId },
        json: body,
      });
      if (!res.ok) {
        throw new Error("Connection test failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Connection successful");
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    },
    onError: (error) => toast.error(error.message),
  });
}

export function usePollEmailIngestAccountNow(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["email-ingest"][":id"]["poll-now"].$post({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to queue the poll");
      }
    },
    onSuccess: () => {
      toast.success("Poll queued, results will appear shortly");
      queryClient.invalidateQueries({ queryKey: emailIngestKeys.lists(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
