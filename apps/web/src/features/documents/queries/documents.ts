import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Types derived from the API
export type DocumentRow = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"]["$get"],
  200
>["documents"][number];

export type DocumentDetail = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$get"],
  200
>["document"];

export type OcrStatus = DocumentRow["ocrStatus"];
export type ThumbnailStatus = DocumentRow["thumbnailStatus"];


type DocumentRef = { orgId: string; id: string };

type DocumentListFilters = {
  orgId: string;
  query?: string;
  storagePathId?: string;
  unfiled?: boolean;
};

export function thumbnailUrl(orgId: string, id: string): string {
  return api.orgs[":orgId"].documents[":id"].thumb.$url({ param: { orgId, id } }).toString();
}

export const documentKeys = {
  root: ["documents"] as const,
  all: (orgId: string) => [...documentKeys.root, orgId] as const,
  lists: (orgId: string) => [...documentKeys.all(orgId), "list"] as const,
  list: ({ orgId, query = "", storagePathId, unfiled }: DocumentListFilters) =>
    [...documentKeys.lists(orgId), { query, storagePathId, unfiled }] as const,
  details: (orgId: string) => [...documentKeys.all(orgId), "detail"] as const,
  detail: ({ orgId, id }: DocumentRef) => [...documentKeys.details(orgId), id] as const,
  activity: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "activity"] as const,
  download: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "download"] as const,
};

export function documentsListQuery({
  orgId,
  query = "",
  storagePathId,
  unfiled,
}: DocumentListFilters) {
  return queryOptions({
    queryKey: documentKeys.list({ orgId, query, storagePathId, unfiled }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents.$get({
        param: { orgId },
        query: {
          ...(query ? { q: query } : {}),
          ...(storagePathId ? { storagePathId } : {}),
          ...(unfiled ? { unfiled: "true" as const } : {}),
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const documents = query.state.data?.documents ?? [];
      const inFlight = documents.some(
        (d) =>
          d.ocrStatus === "pending" ||
          d.ocrStatus === "processing" ||
          d.thumbnailStatus === "pending" ||
          d.thumbnailStatus === "processing",
      );
      return inFlight ? 3000 : false;
    },
  });
}

export function documentDetailQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.detail({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Document not found");
      }
      return res.json();
    },
    // While OCR is in flight, poll so a re-run's progress (pending → processing → completed/failed)
    // lands without a manual refresh. Polling stops once the status settles.
    refetchInterval: (query) => {
      const status = query.state.data?.document.ocrStatus;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function documentDownloadQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.download({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].download.$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to prepare preview");
      }
      return res.json();
    },
    // The /download route signs the URL for 1h; staying fresh for most of that window means a
    // normal viewing session reuses one URL (no re-download), while a long-open page still
    // refetches a new URL on the next focus/remount, well before the 1h expiry.
    staleTime: 50 * 60 * 1000,
  });
}

export function documentActivityQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.activity({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].activity.$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to load activity");
      }
      return res.json();
    },
  });
}

// --- mutations ---
// Each write owns its own invalidation + toast, beside the read factories above, so a key can't
// drift between the read and the write that should refresh it. UI-only side effects (navigation,
// closing a dialog, clearing input) stay in the component via a per-call `mutate(vars, { onSuccess })`.

export type UpdateDocumentMetadataBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$patch"]
>["json"];

// Patch a document's editable metadata (title/date/type/path). exact: refetch only the detail JSON
// — not the nested download (signed URL) or activity — so a metadata edit doesn't remount the PDF
// preview. title/date can show in list views, so refresh those too. On error, re-read the detail so
// the field reverts to server truth instead of keeping a stale optimistic edit.
export function useUpdateDocumentMetadata(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateDocumentMetadataBody) => {
      const res = await api.orgs[":orgId"].documents[":id"].$patch({
        param: { orgId, id: documentId },
        json: body,
      });
      if (!res.ok) {
        throw new Error("Failed to update document");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      toast.error("Failed to update document");
    },
  });
}

// Save a manual OCR-text correction. exact: detail JSON only (not the download URL → no preview
// remount). Editing text re-indexes search server-side (generated column), so refresh lists too.
export function useUpdateOcrText(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ocrText: string) => {
      const res = await api.orgs[":orgId"].documents[":id"]["ocr-text"].$put({
        param: { orgId, id: documentId },
        json: { ocrText },
      });
      if (!res.ok) {
        throw new Error("Failed to save text");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Text saved");
    },
    onError: () => toast.error("Failed to save text"),
  });
}

// Re-run OCR. The route resets status to "pending"; refetch the detail (its refetchInterval then
// polls until the worker settles) and the activity log so the new run shows up.
export function useReprocessDocument(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].process.$post({
        param: { orgId, id: documentId },
      });
      if (!res.ok) {
        throw new Error("Failed to re-run OCR");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.activity({ orgId, id: documentId }) });
      toast.success("OCR re-run started");
    },
    onError: () => toast.error("Failed to re-run OCR"),
  });
}

// Delete a document. Refreshes the list views; the caller handles navigating away from the detail.
export function useDeleteDocument(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].documents[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Delete failed"),
  });
}

// Replace a document's whole tag set (the API is a replace-set PUT). exact: detail JSON only (no
// preview remount); the list is a separate branch refreshed for its next view.
export function useSetDocumentTags(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const res = await api.orgs[":orgId"].documents[":id"].tags.$put({
        param: { orgId, id: documentId },
        json: { tagIds },
      });
      if (!res.ok) {
        throw new Error("Failed to update tags");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
    onError: () => toast.error("Failed to update tags"),
  });
}

// Set one custom-property value on a document. exact: detail JSON only (a property edit changes only
// the detail payload). On error, re-read so the uncontrolled field reverts to server truth.
export function useSetDocumentPropertyValue(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { definitionId: string; value: unknown }) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$put({
        param: { orgId, id: documentId, definitionId: vars.definitionId },
        json: { value: vars.value },
      });
      if (!res.ok) {
        throw new Error("Failed to save property");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      toast.error("Failed to save property");
    },
  });
}

// Clear one custom-property value from a document. Same invalidation as set.
export function useClearDocumentPropertyValue(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$delete({ param: { orgId, id: documentId, definitionId } });
      if (!res.ok) {
        throw new Error("Failed to clear property");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      toast.error("Failed to clear property");
    },
  });
}
