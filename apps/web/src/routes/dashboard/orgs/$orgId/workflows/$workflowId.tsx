import { createFileRoute } from "@tanstack/react-router";
import { WorkflowBuilderPage } from "@/features/workflows/components/workflow-builder-page";

export const Route = createFileRoute("/dashboard/orgs/$orgId/workflows/$workflowId")({
  component: EditWorkflowPage,
});

function EditWorkflowPage() {
  const { orgId, workflowId } = Route.useParams();
  return <WorkflowBuilderPage orgId={orgId} workflowId={workflowId} />;
}
