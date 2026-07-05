import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ensureOrgRole } from "@/features/organization/queries/organization";

export const Route = createFileRoute("/dashboard/orgs/$orgId/workflows")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId", params: { orgId: params.orgId } });
    }
  },
  component: () => (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <Outlet />
    </div>
  ),
});
