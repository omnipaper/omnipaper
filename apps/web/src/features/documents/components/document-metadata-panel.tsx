import { canManageOrg } from "@omnipaper/permissions";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { CreatableCombobox, NONE_LABEL } from "@/components/creatable-combobox";
import {
  orgDocumentTypesQuery,
  useCreateDocumentType,
} from "@/features/document-types/queries/document-types";
import { InlineSuggestion } from "@/features/documents/components/inline-suggestion";
import { TagSuggestions } from "@/features/documents/components/tag-suggestions";
import {
  type DocumentDetail,
  useUpdateDocumentMetadata,
} from "@/features/documents/queries/documents";
import { documentSuggestionsQuery } from "@/features/documents/queries/suggestions";
import { useOrgMember } from "@/features/organization/queries/organization";
import { isValidStoragePath } from "@/features/storage-paths/path-format";
import {
  orgStoragePathsQuery,
  useCreateStoragePath,
} from "@/features/storage-paths/queries/storage-paths";
import { TagPicker } from "@/features/tags/components/tag-picker";

type Props = Pick<
  DocumentDetail,
  "title" | "documentDate" | "documentType" | "storagePath" | "tags"
> & {
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
  tags,
}: Props) {
  const member = useOrgMember(orgId);
  const canManageTaxonomy = canManageOrg(member?.role);

  const { data: typesData } = useQuery(orgDocumentTypesQuery({ orgId }));
  const { data: pathsData } = useQuery(orgStoragePathsQuery({ orgId }));
  const types = typesData?.documentTypes ?? [];
  const paths = pathsData?.storagePaths ?? [];

  const { data: suggestionsData } = useQuery(documentSuggestionsQuery({ orgId, documentId }));
  const suggestions = suggestionsData?.suggestions ?? [];

  const patch = useUpdateDocumentMetadata(orgId, documentId);

  const createType = useCreateDocumentType(orgId);
  const createPath = useCreateStoragePath(orgId);

  function getSuggestionLabel(suggestion: (typeof suggestions)[number]): string {
    const value = suggestion.suggestedValue;
    if (suggestion.field === "documentType" && "id" in value) {
      return types.find((t) => t.id === value.id)?.name ?? "unknown";
    }
    if (suggestion.field === "storagePath" && "id" in value) {
      return paths.find((p) => p.id === value.id)?.path ?? "unknown";
    }
    if ((suggestion.field === "title" || suggestion.field === "documentDate") && "value" in value) {
      return value.value;
    }
    return suggestion.field;
  }

  const titleSuggestion = suggestions.find((s) => s.field === "title");
  const dateSuggestion = suggestions.find((s) => s.field === "documentDate");
  const typeSuggestion = suggestions.find((s) => s.field === "documentType");
  const pathSuggestion = suggestions.find((s) => s.field === "storagePath");
  const tagsSuggestion = suggestions.find((s) => s.field === "tags");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
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
        {titleSuggestion && (
          <InlineSuggestion
            orgId={orgId}
            documentId={documentId}
            suggestionId={titleSuggestion.id}
            label={getSuggestionLabel(titleSuggestion)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
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
        {dateSuggestion && (
          <InlineSuggestion
            orgId={orgId}
            documentId={documentId}
            suggestionId={dateSuggestion.id}
            label={getSuggestionLabel(dateSuggestion)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
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
          placeholder={NONE_LABEL}
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
        {typeSuggestion && (
          <InlineSuggestion
            orgId={orgId}
            documentId={documentId}
            suggestionId={typeSuggestion.id}
            label={getSuggestionLabel(typeSuggestion)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
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
          placeholder={NONE_LABEL}
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
        {pathSuggestion && (
          <InlineSuggestion
            orgId={orgId}
            documentId={documentId}
            suggestionId={pathSuggestion.id}
            label={getSuggestionLabel(pathSuggestion)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tags</Label>
        <TagPicker orgId={orgId} documentId={documentId} tags={tags} />
        {tagsSuggestion && (
          <TagSuggestions
            orgId={orgId}
            documentId={documentId}
            suggestion={tagsSuggestion}
            tags={tags}
          />
        )}
      </div>
    </div>
  );
}
