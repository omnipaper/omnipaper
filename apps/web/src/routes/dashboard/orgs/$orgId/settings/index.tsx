import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "../../../../../lib/auth-client";
import { queryClient } from "../../../../../lib/query-client";
import { sessionQueryOptions } from "../../../../../lib/session";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/")({
  beforeLoad: async ({ params }) => {
    const { data: member } = await authClient.organization.getActiveMember();
    const orgRoles = (member?.role ?? "").split(",");

    if (orgRoles.includes("owner") || orgRoles.includes("admin")) {
      throw redirect({
        to: "/dashboard/orgs/$orgId/settings/general",
        params: { orgId: params.orgId },
      });
    }

    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = session?.user?.role?.split(",").includes("admin") ?? false;

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
