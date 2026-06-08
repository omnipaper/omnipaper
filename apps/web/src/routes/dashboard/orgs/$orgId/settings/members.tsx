import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { MembersManager } from "@/features/organization/components/members-manager";
import { ensureOrgRole } from "@/features/organization/queries/organization";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/members")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: MembersPage,
});

function MembersPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Members</h1>
        <p className="text-muted-foreground text-sm">Manage who can access this organization.</p>
      </div>
      <MembersManager orgId={orgId} />
    </div>
  );
}
