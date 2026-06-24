import { canManageOrg } from "@omnipaper/permissions";
import { Button } from "@omnipaper/ui/components/button";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { CreatableCombobox } from "@/components/creatable-combobox";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import {
  orgDocumentTypesQuery,
  useCreateDocumentType,
} from "@/features/document-types/queries/document-types";
import {
  type DocumentDetail,
  useUpdateDocumentMetadata,
} from "@/features/documents/queries/documents";
import {
  documentSuggestionsQuery,
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/suggestions";
import { useOrgMember } from "@/features/organization/queries/organization";
import { isValidStoragePath } from "@/features/storage-paths/path-format";
import {
  orgStoragePathsQuery,
  useCreateStoragePath,
} from "@/features/storage-paths/queries/storage-paths";
import { orgTagsQuery } from "@/features/tags/queries/tags";

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
  const { data: tagsData } = useQuery(orgTagsQuery({ orgId }));
  const types = typesData?.documentTypes ?? [];
  const paths = pathsData?.storagePaths ?? [];
  const tags = tagsData?.tags ?? [];

  const { data: propsData } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const properties = propsData?.definitions ?? [];

  const { data: suggestionsData } = useQuery(documentSuggestionsQuery({ orgId, documentId }));
  const suggestions = suggestionsData?.suggestions ?? [];
  const accept = useAcceptSuggestion(orgId, documentId);
  const dismiss = useDismissSuggestion(orgId, documentId);

  const patch = useUpdateDocumentMetadata(orgId, documentId);

  const createType = useCreateDocumentType(orgId);
  const createPath = useCreateStoragePath(orgId);

  function suggestionLabel(suggestion: (typeof suggestions)[number]): string {
    const value = suggestion.suggestedValue;
    if (suggestion.field === "documentType" && "id" in value) {
      return `Document type: ${types.find((t) => t.id === value.id)?.name ?? "unknown"}`;
    }
    if (suggestion.field === "storagePath" && "id" in value) {
      return `Storage path: ${paths.find((p) => p.id === value.id)?.path ?? "unknown"}`;
    }
    if ((suggestion.field === "title" || suggestion.field === "documentDate") && "value" in value) {
      return `${suggestion.field === "title" ? "Title" : "Date"}: ${value.value}`;
    }
    if (suggestion.field === "tags" && "existingIds" in value) {
      const names = [
        ...value.existingIds.map((id) => tags.find((t) => t.id === id)?.name ?? id),
        ...value.newNames,
      ];
      return `Tags: ${names.join(", ")}`;
    }
    if (suggestion.field === "customProperty") {
      const prop = properties.find((p) => p.id === suggestion.customPropertyDefinitionId);
      const display =
        "selectOptionId" in value
          ? (prop?.options.find((o) => o.id === value.selectOptionId)?.label ?? "?")
          : "value" in value
            ? value.value
            : "";
      return `${prop?.name ?? "Property"}: ${display}`;
    }
    return suggestion.field;
  }

  return (
    <div className="flex flex-col gap-4">
      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 border-dashed p-3">
          <span className="font-medium text-sm">AI suggestions</span>
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground text-sm">
                {suggestionLabel(suggestion)}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => accept.mutate(suggestion.id)}
                  disabled={accept.isPending}
                >
                  Use
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismiss.mutate(suggestion.id)}
                  disabled={dismiss.isPending}
                  aria-label="Dismiss suggestion"
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

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
