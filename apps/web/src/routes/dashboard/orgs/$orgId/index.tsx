import { createFileRoute } from "@tanstack/react-router";
import { DocumentList } from "../../../../components/document-list";
import { UploadButton } from "../../../../components/upload-button";

export const Route = createFileRoute("/dashboard/orgs/$orgId/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { orgId } = Route.useParams();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <UploadButton orgId={orgId} />
      </div>
      <DocumentList orgId={orgId} />
    </div>
  );
}
