import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DocumentsShell } from "@/features/documents/components/documents-shell";
import { FileViewResults } from "@/features/documents/components/file-view-results";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { clearNavigationSet } from "@/features/documents/navigation/navigation-set";
import { DocumentSelectionProvider } from "@/features/documents/selection/use-document-selection";

// Drive-like folder browsing over the same collection: /documents/fileview?path=/Finance. Shares
// the shell (search/filters/display) with the flat list; FileViewResults scopes the shared
// DocumentList to the current folder and renders subfolder tiles above it, in either layout.
export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/fileview")({
  validateSearch: documentSearchSchema,
  component: FileViewPage,
});

function FileViewPage() {
  const { orgId } = Route.useParams();

  // Any collection page ends an "Open" queue (see navigation-set.ts).
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
