import { createFileRoute } from "@tanstack/react-router";
import { DocumentResults } from "@/features/documents/components/document-results";
import { DocumentsShell } from "@/features/documents/components/documents-shell";
import { documentSearchSchema } from "@/features/documents/filters/search-schema";

// The documents page. `view` (list/gallery) + folder scope (filters.path) + q/filters/sort all live
// in the URL via documentSearchSchema, so switching layout or folder never drops state. Sibling of
// documents.$id.tsx (the detail) — collection at /documents, resource at /documents/:id.
export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/")({
  validateSearch: documentSearchSchema,
  component: DocumentsView,
});

function DocumentsView() {
  const { orgId } = Route.useParams();
  return (
    <DocumentsShell orgId={orgId}>
      <DocumentResults orgId={orgId} />
    </DocumentsShell>
  );
}
