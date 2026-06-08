import { createFileRoute } from "@tanstack/react-router";
import { DocumentDetail } from "@/features/documents/components/document-detail/document-detail";

export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/$id")({
  component: DocumentDetailRoute,
});

function DocumentDetailRoute() {
  const { orgId, id } = Route.useParams();
  return <DocumentDetail orgId={orgId} id={id} />;
}
