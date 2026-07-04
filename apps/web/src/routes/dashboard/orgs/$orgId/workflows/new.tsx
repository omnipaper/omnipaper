import { createFileRoute } from "@tanstack/react-router";
import { WorkflowBuilderPage } from "@/features/workflows/components/workflow-builder-page";

export const Route = createFileRoute("/dashboard/orgs/$orgId/workflows/new")({
  component: NewWorkflowPage,
});

function NewWorkflowPage() {
  const { orgId } = Route.useParams();
  return <WorkflowBuilderPage orgId={orgId} />;
}
