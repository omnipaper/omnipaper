import { CreatableCombobox } from "@/components/creatable-combobox";
import {
  documentTypeKeys,
  orgDocumentTypesQuery,
} from "@/features/document-types/queries/document-types";
import { documentKeys } from "@/features/documents/queries/documents";
import { useOrgMember } from "@/features/organization/queries/organization";
import { isValidStoragePath } from "@/features/storage-paths/path-format";
import {
  orgStoragePathsQuery,
  storagePathKeys,
} from "@/features/storage-paths/queries/storage-paths";
import { api } from "@/lib/api";
import { canManageOrg } from "@omnipaper/permissions";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";
import { toast } from "sonner";

type PatchBody = InferRequestType<
  (typeof api.orgs)[":orgId"]["documents"][":id"]["$patch"]
>["json"];

type Props = {
  orgId: string;
  documentId: string;
  title: string;
  documentDate: string | null;
  documentType: { id: string; name: string } | null;
  storagePath: { id: string; path: string } | null;
};

export function DocumentMetadataPanel({
  orgId,
  documentId,
  title,
  documentDate,
  documentType,
  storagePath,
}: Props) {
  const queryClient = useQueryClient();
  const member = useOrgMember(orgId);
  // Members are read-only on the org taxonomy — only owners/admins may create types/paths, so the
  // combobox's "Create …" row is gated to them. Selecting an existing value stays open to everyone.
  const canManageTaxonomy = canManageOrg(member?.role);

  const { data: typesData } = useQuery(orgDocumentTypesQuery({ orgId }));
  const { data: pathsData } = useQuery(orgStoragePathsQuery({ orgId }));
  const types = typesData?.documentTypes ?? [];
  const paths = pathsData?.storagePaths ?? [];

  const patchMutation = useMutation({
    mutationFn: async (body: PatchBody) => {
      const res = await api.orgs[":orgId"].documents[":id"].$patch({
        param: { orgId, id: documentId },
        json: body,
      });
      if (!res.ok) {
        throw new Error("Failed to update document");
      }
    },
    onSuccess: () => {
      // exact: only the detail JSON — not the nested download (signed URL) or activity, which would
      // otherwise refetch and remount the PDF preview on every metadata edit.
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      // title / date can show in list views, so refresh those too.
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
    },
    // Revert the field to server truth (via the detail refetch) instead of leaving a stale edit.
    onError: () => {
      // exact: only the detail JSON — not the nested download (signed URL) or activity, which would
      // otherwise refetch and remount the PDF preview on every metadata edit.
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      toast.error("Failed to update document");
    },
  });

  // Create-and-assign: POST the new taxonomy entry, refresh its list so the combobox shows it, then
  // patch the document to select it (server truth flows back via the detail refetch).
  const createTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.orgs[":orgId"]["document-types"].$post({
        param: { orgId },
        json: { name },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A document type with this name already exists"
            : "Failed to create document type",
        );
      }
      return res.json();
    },
    onSuccess: ({ documentType: created }) => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
      patchMutation.mutate({ documentTypeId: created.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const createPathMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await api.orgs[":orgId"]["storage-paths"].$post({
        param: { orgId },
        json: { path },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "Invalid path, or a storage path with this value already exists"
            : "Failed to create storage path",
        );
      }
      return res.json();
    },
    onSuccess: ({ storagePath: created }) => {
      queryClient.invalidateQueries({ queryKey: storagePathKeys.lists(orgId) });
      patchMutation.mutate({ storagePathId: created.id });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-title">Title</Label>
        <Input
          id="doc-title"
          key={title}
          defaultValue={title}
          maxLength={255}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== title) {
              patchMutation.mutate({ title: value });
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-date">Document date</Label>
        <Input
          id="doc-date"
          type="date"
          key={documentDate ?? ""}
          defaultValue={documentDate ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value !== (documentDate ?? "")) {
              patchMutation.mutate({ documentDate: value || null });
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-type">Document type</Label>
        <CreatableCombobox
          triggerId="doc-type"
          aria-label="Document type"
          items={types.map((type) => ({ id: type.id, label: type.name }))}
          value={documentType?.id ?? null}
          onSelect={(id) => patchMutation.mutate({ documentTypeId: id })}
          placeholder="None"
          searchPlaceholder="Search or create type…"
          canCreate={canManageTaxonomy}
          onCreate={(name) => createTypeMutation.mutate(name)}
          pending={patchMutation.isPending || createTypeMutation.isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-path">Storage path</Label>
        <CreatableCombobox
          triggerId="doc-path"
          aria-label="Storage path"
          items={paths.map((path) => ({ id: path.id, label: path.path }))}
          value={storagePath?.id ?? null}
          onSelect={(id) => patchMutation.mutate({ storagePathId: id })}
          placeholder="None"
          searchPlaceholder="Search or create path… (/Finance/2024)"
          itemClassName="font-mono"
          canCreate={canManageTaxonomy}
          onCreate={(path) => createPathMutation.mutate(path)}
          validateCreate={isValidStoragePath}
          pending={patchMutation.isPending || createPathMutation.isPending}
        />
      </div>
    </div>
  );
}
