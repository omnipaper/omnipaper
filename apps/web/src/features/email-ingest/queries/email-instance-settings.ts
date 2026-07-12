import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Instance-wide (admin-only) email settings — the SSRF guard toggle, not org data.
export const emailInstanceSettingsKeys = {
  all: ["settings", "email"] as const,
};

export function emailInstanceSettingsQuery() {
  return queryOptions({
    queryKey: emailInstanceSettingsKeys.all,
    queryFn: async () => {
      const res = await api.settings.email.$get();
      if (!res.ok) {
        throw new Error("Failed to load email settings");
      }
      return res.json();
    },
  });
}

export function useSaveEmailInstanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { allowInternalHosts: boolean }) => {
      const res = await api.settings.email.$put({ json: input });
      if (!res.ok) {
        throw new Error("Failed to save email settings");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailInstanceSettingsKeys.all });
      toast.success("Email settings saved");
    },
    onError: (error) => toast.error(error.message),
  });
}
