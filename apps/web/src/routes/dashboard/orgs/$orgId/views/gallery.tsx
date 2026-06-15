import { createFileRoute } from "@tanstack/react-router";
import { DocumentGallery } from "@/features/documents/components/document-gallery";
import { UploadButton } from "@/features/documents/components/upload-button";

type GallerySearch = { q?: string };

export const Route = createFileRoute("/dashboard/orgs/$orgId/views/gallery")({
  validateSearch: (search: Record<string, unknown>): GallerySearch => {
    const q = search.q;
    return typeof q === "string" && q.length > 0 ? { q } : {};
  },
  component: GalleryView,
});

function GalleryView() {
  const { orgId } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gallery</h1>
        <UploadButton orgId={orgId} />
      </div>
      <DocumentGallery
        orgId={orgId}
        initialSearch={q ?? ""}
        onSearchCommit={(next) => navigate({ search: next ? { q: next } : {}, replace: true })}
      />
    </div>
  );
}
