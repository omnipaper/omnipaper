import { createFileRoute, redirect } from "@tanstack/react-router";
import { MembersManager } from "../../../../../components/members-manager";
import { authClient } from "../../../../../lib/auth-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/members")({
  beforeLoad: async ({ params }) => {
    const { data: member } = await authClient.organization.getActiveMember();
    const roles = (member?.role ?? "").split(",");

    if (!roles.includes("owner") && !roles.includes("admin")) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: MembersPage,
});

function MembersPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Members</h1>
        <p className="text-muted-foreground text-sm">Manage who can access this organization.</p>
      </div>
      <MembersManager />
    </div>
  );
}
