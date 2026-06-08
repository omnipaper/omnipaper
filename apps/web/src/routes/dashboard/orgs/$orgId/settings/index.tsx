import { sessionQueryOptions } from "@/features/auth/queries/session";
import { ensureOrgRole } from "@/features/organization/queries/organization";
import { queryClient } from "@/lib/query-client";
import { canManageOrg, isInstanceAdmin } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (canManageOrg(role)) {
      throw redirect({
        to: "/dashboard/orgs/$orgId/settings/general",
        params: { orgId: params.orgId },
      });
    }

    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = isInstanceAdmin(session?.user?.role);

    if (isAdmin) {
      throw redirect({
        to: "/dashboard/orgs/$orgId/settings/storage",
        params: { orgId: params.orgId },
      });
    }
  },
  component: SettingsIndexPage,
});

function SettingsIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
      <h1 className="font-semibold text-2xl">Settings</h1>
      <p className="text-muted-foreground text-sm">Nothing here yet.</p>
    </div>
  );
}
