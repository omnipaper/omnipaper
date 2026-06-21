import { canManageOrg } from "@omnipaper/permissions";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { CreatableCombobox } from "@/components/creatable-combobox";
import {
  orgDocumentTypesQuery,
  useCreateDocumentType,
} from "@/features/document-types/queries/document-types";
import {
  type DocumentDetail,
  useUpdateDocumentMetadata,
} from "@/features/documents/queries/documents";
import { useOrgMember } from "@/features/organization/queries/organization";
import { isValidStoragePath } from "@/features/storage-paths/path-format";
import {
  orgStoragePathsQuery,
  useCreateStoragePath,
} from "@/features/storage-paths/queries/storage-paths";

type Props = Pick<DocumentDetail, "title" | "documentDate" | "documentType" | "storagePath"> & {
  orgId: string;
  documentId: string;
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
  const canManageTaxonomy = canManageOrg(member?.role);

  const { data: typesData } = useQuery(orgDocumentTypesQuery({ orgId }));
  const { data: pathsData } = useQuery(orgStoragePathsQuery({ orgId }));
  const types = typesData?.documentTypes ?? [];
  const paths = pathsData?.storagePaths ?? [];

  const patch = useUpdateDocumentMetadata(orgId, documentId);

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
              patch.mutate({ body: { title: value }, optimistic: { title: value } });
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
              const next = value || null;
              patch.mutate({ body: { documentDate: next }, optimistic: { documentDate: next } });
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
          onSelect={(id) => {
            const selected = id ? (types.find((t) => t.id === id) ?? null) : null;
            patch.mutate({
              body: { documentTypeId: id },
              optimistic: {
                documentType: selected ? { id: selected.id, name: selected.name } : null,
              },
            });
          }}
          placeholder="None"
          searchPlaceholder="Search or create type…"
          canCreate={canManageTaxonomy}
          onCreate={(name) =>
            createType.mutate(name, {
              onSuccess: ({ documentType: created }) =>
                patch.mutate({
                  body: { documentTypeId: created.id },
                  optimistic: { documentType: { id: created.id, name: created.name } },
                }),
            })
          }
          pending={createType.isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-path">Storage path</Label>
        <CreatableCombobox
          triggerId="doc-path"
          aria-label="Storage path"
          items={paths.map((path) => ({ id: path.id, label: path.path }))}
          value={storagePath?.id ?? null}
          onSelect={(id) => {
            const selected = id ? (paths.find((p) => p.id === id) ?? null) : null;
            patch.mutate({
              body: { storagePathId: id },
              optimistic: {
                storagePath: selected ? { id: selected.id, path: selected.path } : null,
              },
            });
          }}
          placeholder="None"
          searchPlaceholder="Search or create path… (/Finance/2024)"
          canCreate={canManageTaxonomy}
          onCreate={(path) =>
            createPath.mutate(path, {
              onSuccess: ({ storagePath: created }) =>
                patch.mutate({
                  body: { storagePathId: created.id },
                  optimistic: { storagePath: { id: created.id, path: created.path } },
                }),
            })
          }
          validateCreate={isValidStoragePath}
          pending={createPath.isPending}
        />
      </div>
    </div>
  );
}
