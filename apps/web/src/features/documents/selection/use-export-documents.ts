import type { FilterState, SortState } from "@omnipaper/shared/document-filters";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export type ExportSelection =
  | { documents: string[] }
  | { all: true; q?: string; filters?: FilterState; sort?: SortState };

// Posts the selection (explicit ids or "all matching") to the export endpoint, receives the zip as a
// blob, and triggers a browser download via a temporary object-URL anchor — no extra dependency.
export function useExportDocuments(orgId: string) {
  return useMutation({
    mutationFn: async (selection: ExportSelection) => {
      const res = await api.orgs[":orgId"].documents.export.$post({
        param: { orgId },
        json: selection,
      });
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "documents.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error("Failed to download documents"),
  });
}
