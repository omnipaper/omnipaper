import {
  encodeFilters,
  encodeSort,
  type FilterState,
  type SortState,
} from "@omnipaper/shared/document-filters";
import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";
import { toast } from "sonner";
import { removeRecent } from "@/features/documents/recent/recent-documents-store";
import { api } from "@/lib/api";
export type DocumentRow = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"]["$get"],
  200
>["documents"][number];
export type DocumentDetail = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$get"],
  200
>["document"];
export type DocumentActivity = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["activity"]["$get"],
  200
>["activities"][number];
// The detail query caches the whole envelope ({ document }); the optimistic tag patch rewrites
// document.tags inside it. A single tag chip as embedded in the detail/list responses.
type DocumentDetailData = InferResponseType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$get"],
  200
>;
export type DocumentTag = DocumentDetail["tags"][number];
export type OcrStatus = DocumentRow["ocrStatus"];
type DocumentRef = {
  orgId: string;
  id: string;
};
type DocumentListFilters = {
  orgId: string;
  query?: string;
  filters?: FilterState;
  sort?: SortState;
};
export function thumbnailUrl(orgId: string, id: string): string {
  return api.orgs[":orgId"].documents[":id"].thumb.$url({ param: { orgId, id } }).toString();
}
export const documentKeys = {
  root: ["documents"] as const,
  all: (orgId: string) => [...documentKeys.root, orgId] as const,
  lists: (orgId: string) => [...documentKeys.all(orgId), "list"] as const,
  list: ({ orgId, query = "", filters, sort }: DocumentListFilters) =>
    [
      ...documentKeys.lists(orgId),
      { query, filters: filters ?? null, sort: sort ?? null },
    ] as const,
  details: (orgId: string) => [...documentKeys.all(orgId), "detail"] as const,
  detail: ({ orgId, id }: DocumentRef) => [...documentKeys.details(orgId), id] as const,
  activity: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "activity"] as const,
  download: ({ orgId, id }: DocumentRef) =>
    [...documentKeys.detail({ orgId, id }), "download"] as const,
};
export function documentsListQuery({ orgId, query = "", filters, sort }: DocumentListFilters) {
  return infiniteQueryOptions({
    queryKey: documentKeys.list({ orgId, query, filters, sort }),
    queryFn: async ({ pageParam }) => {
      const res = await api.orgs[":orgId"].documents.$get({
        param: { orgId },
        query: {
          ...(query ? { q: query } : {}),
          ...(filters && Object.keys(filters).length > 0
            ? { filters: encodeFilters(filters) }
            : {}),
          ...(sort ? { sort: encodeSort(sort) } : {}),
          // pageParam is the previous page's nextCursor; absent on the first page.
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => {
      // Poll only while something on a loaded page is still processing (OCR/thumbnail).
      const documents = query.state.data?.pages.flatMap((p) => p.documents) ?? [];
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
export class DocumentNotFoundError extends Error {}

export function documentDetailQuery({ orgId, id }: DocumentRef) {
  return queryOptions({
    queryKey: documentKeys.detail({ orgId, id }),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].$get({ param: { orgId, id } });
      if (res.status === 404) {
        throw new DocumentNotFoundError("Document not found");
      }
      if (!res.ok) {
        throw new Error("Failed to load document");
      }
      return res.json();
    },
    retry: (failureCount, error) => !(error instanceof DocumentNotFoundError) && failureCount < 3,
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
export type UpdateDocumentMetadataBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$patch"]
>["json"];
// The PATCH takes ids (documentTypeId/storagePathId); the detail cache stores resolved objects
// (documentType: { id, name }, …). The caller passes both: the API body and the matching detail patch.
type UpdateDocumentMetadataVars = {
  body: UpdateDocumentMetadataBody;
  optimistic: Partial<DocumentDetail>;
};
export function useUpdateDocumentMetadata(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  const detailKey = documentKeys.detail({ orgId, id: documentId });
  return useMutation({
    mutationFn: async ({ body }: UpdateDocumentMetadataVars) => {
      const res = await api.orgs[":orgId"].documents[":id"].$patch({
        param: { orgId, id: documentId },
        json: body,
      });
      if (!res.ok) {
        throw new Error("Failed to update document");
      }
    },
    onMutate: async ({ optimistic }) => {
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      const previous = queryClient.getQueryData<DocumentDetailData>(detailKey);
      if (previous) {
        queryClient.setQueryData<DocumentDetailData>(detailKey, {
          ...previous,
          document: { ...previous.document, ...optimistic },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      toast.error("Failed to update document");
    },
    onSettled: () => {
      // PATCH returns only { ok }, so reconcile the detail with server truth; list rows show the
      // title (and type/path in some views), so refresh those in the background too.
      queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
  });
}
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
export function useDeleteDocument(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].documents[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: (_data, id) => {
      removeRecent(orgId, id);
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Delete failed"),
  });
}
export function useSetDocumentTags(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  const detailKey = documentKeys.detail({ orgId, id: documentId });
  return useMutation({
    // The picker hands us the full next tag set (with name/color), so chips can render
    // optimistically; the API only needs the ids, so derive them here.
    mutationFn: async (nextTags: DocumentTag[]) => {
      const res = await api.orgs[":orgId"].documents[":id"].tags.$put({
        param: { orgId, id: documentId },
        json: { tagIds: nextTags.map((t) => t.id) },
      });
      if (!res.ok) {
        throw new Error("Failed to update tags");
      }
      return res.json();
    },
    // The PUT replaces the whole set, so overlapping writes for one document could drop a
    // concurrent toggle. Same-scope mutations run one at a time, making rapid toggles safe.
    scope: { id: `document-tags:${documentId}` },
    onMutate: async (nextTags) => {
      // Stop any in-flight detail refetch from clobbering the optimistic write.
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      const previous = queryClient.getQueryData<DocumentDetailData>(detailKey);
      if (previous) {
        queryClient.setQueryData<DocumentDetailData>(detailKey, {
          ...previous,
          document: { ...previous.document, tags: nextTags },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      toast.error("Failed to update tags");
    },
    onSuccess: ({ tags }) => {
      // The PUT returns the authoritative tag set — write it straight in, no detail refetch.
      queryClient.setQueryData<DocumentDetailData>(detailKey, (old) =>
        old ? { ...old, document: { ...old.document, tags } } : old,
      );
    },
    onSettled: () => {
      // List rows embed tag chips; refresh them in the background (the user is on the detail).
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
  });
}
// Optimistically upsert (value given) or remove (value === undefined) a custom-property value inside
// the cached detail envelope, leaving every other field untouched.
function patchDetailProperty(
  data: DocumentDetailData,
  definitionId: string,
  value: unknown | undefined,
): DocumentDetailData {
  const current = data.document.customProperties;
  const next =
    value === undefined
      ? current.filter((p) => p.definitionId !== definitionId)
      : current.some((p) => p.definitionId === definitionId)
        ? current.map((p) => (p.definitionId === definitionId ? { ...p, value } : p))
        : [...current, { definitionId, value }];
  // The cache value type is JSONValue; the optimistic value is best-effort and reconciled on
  // settle, so assert rather than thread JSONValue through every call site.
  return {
    ...data,
    document: {
      ...data.document,
      customProperties: next as DocumentDetail["customProperties"],
    },
  };
}
// The PUT takes a bare value (a select sends an option id); the detail cache stores the resolved
// shape (select → { id, label, color }), so the caller passes the stored form as optimisticValue.
type SetPropertyValueVars = { definitionId: string; value: unknown; optimisticValue: unknown };
export function useSetDocumentPropertyValue(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  const detailKey = documentKeys.detail({ orgId, id: documentId });
  return useMutation({
    mutationFn: async ({ definitionId, value }: SetPropertyValueVars) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$put({
        param: { orgId, id: documentId, definitionId },
        json: { value },
      });
      if (!res.ok) {
        throw new Error("Failed to save property");
      }
    },
    onMutate: async ({ definitionId, optimisticValue }) => {
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      const previous = queryClient.getQueryData<DocumentDetailData>(detailKey);
      if (previous) {
        queryClient.setQueryData<DocumentDetailData>(
          detailKey,
          patchDetailProperty(previous, definitionId, optimisticValue),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      toast.error("Failed to save property");
    },
    // PUT returns only { ok }; reconcile the detail with server truth. Property values aren't on the
    // list, so no list invalidation needed.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
    },
  });
}
export function useClearDocumentPropertyValue(orgId: string, documentId: string) {
  const queryClient = useQueryClient();
  const detailKey = documentKeys.detail({ orgId, id: documentId });
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$delete({ param: { orgId, id: documentId, definitionId } });
      if (!res.ok) {
        throw new Error("Failed to clear property");
      }
    },
    onMutate: async (definitionId) => {
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      const previous = queryClient.getQueryData<DocumentDetailData>(detailKey);
      if (previous) {
        queryClient.setQueryData<DocumentDetailData>(
          detailKey,
          patchDetailProperty(previous, definitionId, undefined),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey, context.previous);
      }
      toast.error("Failed to clear property");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey, exact: true });
    },
  });
}
