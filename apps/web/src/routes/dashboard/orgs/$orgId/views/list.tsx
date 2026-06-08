import { createFileRoute } from "@tanstack/react-router";
import { DocumentList } from "@/features/documents/components/document-list";
import { UploadButton } from "@/features/documents/components/upload-button";

// Built-in view: flat list of all documents, full-text searchable. The search term lives in `?q`
// (URL = single source of truth for view state — see plan), so it's deep-linkable and shareable.
type ListSearch = { q?: string };

export const Route = createFileRoute("/dashboard/orgs/$orgId/views/list")({
  validateSearch: (search: Record<string, unknown>): ListSearch => {
    const q = search.q;
    return typeof q === "string" && q.length > 0 ? { q } : {};
  },
  component: ListView,
});

function ListView() {
  const { orgId } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <UploadButton orgId={orgId} />
      </div>
      <DocumentList
        orgId={orgId}
        initialSearch={q ?? ""}
        onSearchCommit={(next) => navigate({ search: next ? { q: next } : {}, replace: true })}
      />
    </div>
  );
}
