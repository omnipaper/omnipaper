import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { toast } from "sonner";
import { api } from "@/lib/api";

// The client-facing migration shape, derived from the API so it can't drift from what the server
// returns. `preview`/`report` arrive as `unknown` here (see the view types below).
export type MigrationDto = InferResponseType<
  (typeof api.orgs)[":orgId"]["migrations"][":id"]["$get"],
  200
>["migration"];

// `preview` and `report` cross the API boundary as opaque JSON (typed `unknown`), so the shapes the
// engine writes are mirrored here for rendering. Keep in sync with the migration engine's
// AnalyzeResult / MigrationReport.
export type MigrationPreview = {
  counts: {
    documents: number;
    tags: number;
    documentTypes: number;
    storagePaths: number;
    customPropertyDefs: number;
  };
  ledger: {
    notes: number;
    savedViews: number;
    workflows: number;
    droppedCustomFields: number;
    perDocumentPermissions: number;
    archiveSerialNumbers: number;
    trashedDocuments: number;
    mergedTaxonomy: { kind: string; name: string; count: number }[];
    unknownModels: Record<string, number>;
  };
  ownerBreakdown: { owner: string | null; documents: number }[];
  missingFiles: string[];
  mimeBreakdown: Record<string, number>;
  needsTimezone: boolean;
};

export type MigrationReport = {
  imported: number;
  duplicate: number;
  failed: number;
  errors: { sourceId: string; fileRef: string; message: string }[];
};

// Statuses where the background worker is doing something, so the detail view should poll.
const POLLING_STATUSES = new Set(["analyzing", "importing"]);
// Statuses where a run still occupies the org's single active slot — used to resume on load.
export const ACTIVE_STATUSES = new Set([
  "created",
  "analyzing",
  "awaiting_confirmation",
  "importing",
]);

export const migrationKeys = {
  all: (orgId: string) => ["migrations", orgId] as const,
  list: (orgId: string) => [...migrationKeys.all(orgId), "list"] as const,
  detail: (orgId: string, id: string) => [...migrationKeys.all(orgId), "detail", id] as const,
};

export function migrationsListQuery(orgId: string) {
  return queryOptions({
    queryKey: migrationKeys.list(orgId),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].migrations.$get({ param: { orgId } });
      if (!res.ok) {
        throw new Error("Failed to load migrations");
      }
      return res.json();
    },
  });
}

export function migrationDetailQuery(orgId: string, id: string) {
  return queryOptions({
    queryKey: migrationKeys.detail(orgId, id),
    queryFn: async () => {
      const res = await api.orgs[":orgId"].migrations[":id"].$get({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Migration not found");
      }
      return res.json();
    },
    // Poll while the worker is analyzing or importing; awaiting_confirmation/done/failed are settled.
    refetchInterval: (query) =>
      POLLING_STATUSES.has(query.state.data?.migration.status ?? "") ? 1500 : false,
  });
}

async function apiErrorMessage(res: { json: () => Promise<unknown> }, fallback: string) {
  try {
    const body = await res.json();
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    return typeof message === "string" ? message : fallback;
  } catch {
    return fallback;
  }
}

export type UploadProgress = { partsDone: number; partsTotal: number };

// Create the migration, upload the ZIP straight to storage in fixed-size parts via presigned URLs,
// then finalize. Returns the migration id (now "analyzing"). Not a hook — it's a multi-step process
// driven from a component with its own progress state.
export async function uploadAndStartMigration(
  orgId: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<string> {
  const createRes = await api.orgs[":orgId"].migrations.$post({
    param: { orgId },
    json: { source: "paperless" },
  });
  if (!createRes.ok) {
    throw new Error(await apiErrorMessage(createRes, "Couldn't start the migration"));
  }
  const { migrationId, partSize } = await createRes.json();

  const partsTotal = Math.max(1, Math.ceil(file.size / partSize));
  const parts: { partNumber: number; etag: string }[] = [];

  for (let index = 0; index < partsTotal; index++) {
    const partNumber = index + 1;
    const start = index * partSize;
    const blob = file.slice(start, Math.min(start + partSize, file.size));

    const signRes = await api.orgs[":orgId"].migrations[":id"].parts.$post({
      param: { orgId, id: migrationId },
      json: { partNumber },
    });
    if (!signRes.ok) {
      throw new Error("Couldn't get an upload URL");
    }
    const { url } = await signRes.json();

    const putRes = await fetch(url, { method: "PUT", body: blob });
    if (!putRes.ok) {
      throw new Error(`Upload failed on part ${partNumber} of ${partsTotal}`);
    }
    const etag = putRes.headers.get("ETag") ?? putRes.headers.get("etag");
    if (!etag) {
      throw new Error(
        "Storage didn't return an ETag — check the bucket's CORS exposes the ETag header",
      );
    }
    parts.push({ partNumber, etag });
    onProgress({ partsDone: partNumber, partsTotal });
  }

  const completeRes = await api.orgs[":orgId"].migrations[":id"]["complete-upload"].$post({
    param: { orgId, id: migrationId },
    json: { parts },
  });
  if (!completeRes.ok) {
    throw new Error("Couldn't finalize the upload");
  }

  return migrationId;
}

export function useConfirmMigration(orgId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (options: { importOcr: boolean; timezone?: string }) => {
      const res = await api.orgs[":orgId"].migrations[":id"].confirm.$post({
        param: { orgId, id },
        json: options,
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Couldn't start the import"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.detail(orgId, id) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't start the import"),
  });
}

export function useCancelMigration(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].migrations[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Couldn't cancel the migration"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.all(orgId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't cancel"),
  });
}
