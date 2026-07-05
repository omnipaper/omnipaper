import { Separator } from "@omnipaper/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { CustomPropertyFields } from "@/features/custom-properties/components/custom-property-fields";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import { DocumentMetadataPanel } from "@/features/documents/components/document-metadata-panel";
import type { DocumentDetail } from "@/features/documents/queries/documents";
import { documentSuggestionsQuery } from "@/features/documents/queries/suggestions";

type Props = Pick<
  DocumentDetail,
  "title" | "documentDate" | "documentType" | "storagePath" | "tags" | "customProperties"
> & {
  orgId: string;
  documentId: string;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </h3>
  );
}

export function DetailsTab({
  orgId,
  documentId,
  title,
  documentDate,
  documentType,
  storagePath,
  tags,
  customProperties,
}: Props) {
  const { data: definitionsData } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const hasProperties = (definitionsData?.definitions.length ?? 0) > 0;

  const { data: suggestionsData } = useQuery(documentSuggestionsQuery({ orgId, documentId }));
  const propertySuggestions =
    suggestionsData?.suggestions?.filter((s) => s.field === "customProperty") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionLabel>Metadata</SectionLabel>
        <DocumentMetadataPanel
          orgId={orgId}
          documentId={documentId}
          title={title}
          documentDate={documentDate}
          documentType={documentType}
          storagePath={storagePath}
          tags={tags}
        />
      </section>

      {hasProperties ? (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <SectionLabel>Custom properties</SectionLabel>
            <CustomPropertyFields
              orgId={orgId}
              documentId={documentId}
              values={customProperties}
              suggestions={propertySuggestions}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
