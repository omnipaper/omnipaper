import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DocumentList } from "@/features/documents/components/document-list";
import { DocumentsShell } from "@/features/documents/components/documents-shell";
import { saveLastListSearch } from "@/features/documents/filters/last-list-search";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";
import { clearNavigationSet } from "@/features/documents/navigation/navigation-set";
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

  // Any collection page ends an "Open" queue (see navigation-set.ts).
  useEffect(() => {
    clearNavigationSet(orgId);
  }, [orgId]);

  return (
    <DocumentSelectionProvider>
      <DocumentsShell orgId={orgId}>
        <DocumentList orgId={orgId} />
      </DocumentsShell>
    </DocumentSelectionProvider>
  );
}
