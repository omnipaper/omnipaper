import { createFileRoute } from "@tanstack/react-router";
import { WorkflowsList } from "@/features/workflows/components/workflows-list";

export const Route = createFileRoute("/dashboard/orgs/$orgId/workflows/")({
  component: WorkflowsListPage,
});

function WorkflowsListPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Workflows</h1>
        <p className="text-muted-foreground text-sm">
          Automate actions when documents are added or processed.
        </p>
      </div>
      <WorkflowsList orgId={orgId} />
    </div>
  );
}
