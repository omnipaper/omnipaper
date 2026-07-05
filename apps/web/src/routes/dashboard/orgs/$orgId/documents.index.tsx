import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DocumentResults } from "@/features/documents/components/document-results";
import { DocumentsShell } from "@/features/documents/components/documents-shell";
import { saveLastListSearch } from "@/features/documents/filters/last-list-search";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { DocumentSelectionProvider } from "@/features/documents/selection/use-document-selection";

// The documents page. `view` (list/gallery) + folder scope (filters.path) + q/filters/sort all live
// in the URL via documentSearchSchema, so switching layout or folder never drops state. Sibling of
// documents.$id.tsx (the detail) — collection at /documents, resource at /documents/:id.
export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/")({
  validateSearch: documentSearchSchema,
  component: DocumentsView,
});

function DocumentsView() {
  const { orgId } = Route.useParams();
  const search = Route.useSearch();

  // Remember where the list is, so leaving a document can come back here (see last-list-search.ts).
  useEffect(() => {
    saveLastListSearch(orgId, search);
  }, [orgId, search]);

  return (
    <DocumentSelectionProvider>
      <DocumentsShell orgId={orgId}>
        <DocumentResults orgId={orgId} />
      </DocumentsShell>
    </DocumentSelectionProvider>
  );
}
