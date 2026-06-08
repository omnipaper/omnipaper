import { canManageOrg } from "@omnipaper/permissions";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { CreatableCombobox } from "@/components/creatable-combobox";
import {
  orgDocumentTypesQuery,
  useCreateDocumentType,
} from "@/features/document-types/queries/document-types";
import { useUpdateDocumentMetadata } from "@/features/documents/queries/documents";
import { useOrgMember } from "@/features/organization/queries/organization";
import { isValidStoragePath } from "@/features/storage-paths/path-format";
import {
  orgStoragePathsQuery,
  useCreateStoragePath,
} from "@/features/storage-paths/queries/storage-paths";

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
  const member = useOrgMember(orgId);
  // Members are read-only on the org taxonomy — only owners/admins may create types/paths, so the
  // combobox's "Create …" row is gated to them. Selecting an existing value stays open to everyone.
  const canManageTaxonomy = canManageOrg(member?.role);

  const { data: typesData } = useQuery(orgDocumentTypesQuery({ orgId }));
  const { data: pathsData } = useQuery(orgStoragePathsQuery({ orgId }));
  const types = typesData?.documentTypes ?? [];
  const paths = pathsData?.storagePaths ?? [];

  const patch = useUpdateDocumentMetadata(orgId, documentId);
  // Create-and-assign: create the taxonomy entry, then (on success) patch the document to select it.
  // Each create hook refreshes its own list; the patch's server truth flows back via the detail
  // refetch.
  const createType = useCreateDocumentType(orgId);
  const createPath = useCreateStoragePath(orgId);

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
              patch.mutate({ title: value });
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
              patch.mutate({ documentDate: value || null });
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
          onSelect={(id) => patch.mutate({ documentTypeId: id })}
          placeholder="None"
          searchPlaceholder="Search or create type…"
          canCreate={canManageTaxonomy}
          onCreate={(name) =>
            createType.mutate(name, {
              onSuccess: ({ documentType: created }) =>
                patch.mutate({ documentTypeId: created.id }),
            })
          }
          pending={patch.isPending || createType.isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-path">Storage path</Label>
        <CreatableCombobox
          triggerId="doc-path"
          aria-label="Storage path"
          items={paths.map((path) => ({ id: path.id, label: path.path }))}
          value={storagePath?.id ?? null}
          onSelect={(id) => patch.mutate({ storagePathId: id })}
          placeholder="None"
          searchPlaceholder="Search or create path… (/Finance/2024)"
          canCreate={canManageTaxonomy}
          onCreate={(path) =>
            createPath.mutate(path, {
              onSuccess: ({ storagePath: created }) => patch.mutate({ storagePathId: created.id }),
            })
          }
          validateCreate={isValidStoragePath}
          pending={patch.isPending || createPath.isPending}
        />
      </div>
    </div>
  );
}
