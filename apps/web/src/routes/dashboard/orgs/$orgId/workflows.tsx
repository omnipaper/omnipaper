import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureOrgRole } from "@/features/organization/queries/organization";
import { WorkflowsManager } from "@/features/workflows/components/workflows-manager";

export const Route = createFileRoute("/dashboard/orgs/$orgId/workflows")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId", params: { orgId: params.orgId } });
    }
  },
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Workflows</h1>
        <p className="text-muted-foreground text-sm">
          Automate actions when documents are added or processed.
        </p>
      </div>
      <WorkflowsManager orgId={orgId} />
    </div>
  );
}
