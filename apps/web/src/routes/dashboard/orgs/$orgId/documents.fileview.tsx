import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DocumentsShell } from "@/features/documents/components/documents-shell";
import { FileViewResults } from "@/features/documents/components/file-view-results";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { clearNavigationSet } from "@/features/documents/navigation/navigation-set";
import { DocumentSelectionProvider } from "@/features/documents/selection/use-document-selection";

export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/fileview")({
  validateSearch: documentSearchSchema,
  component: FileViewPage,
});

function FileViewPage() {
  const { orgId } = Route.useParams();

  useEffect(() => {
    clearNavigationSet(orgId);
  }, [orgId]);

  return (
    <DocumentSelectionProvider>
      <DocumentsShell orgId={orgId} fileView>
        <FileViewResults orgId={orgId} />
      </DocumentsShell>
    </DocumentSelectionProvider>
  );
}
