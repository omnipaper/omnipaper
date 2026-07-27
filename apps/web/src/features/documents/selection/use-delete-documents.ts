import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { documentKeys } from "@/features/documents/queries/documents";
import { removeRecent } from "@/features/documents/recent/recent-documents-store";
import { api } from "@/lib/api";

// Explicit ids only — the endpoint deliberately has no "all matching" shape, because deletion here
// removes the stored objects too and there is no trash to recover from.
export function useDeleteDocuments(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.orgs[":orgId"].documents.delete.$post({
        param: { orgId },
        json: { documents: ids },
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      return res.json();
    },
    onSuccess: (result, ids) => {
      for (const id of ids) {
        removeRecent(orgId, id);
      }

      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success(
        result.deleted === 1 ? "Document deleted" : `${result.deleted} documents deleted`,
      );
    },
    onError: () => toast.error("Delete failed"),
  });
}
