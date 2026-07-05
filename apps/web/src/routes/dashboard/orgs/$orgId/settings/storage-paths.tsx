import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureOrgRole } from "@/features/organization/queries/organization";
import { StoragePathsManager } from "@/features/storage-paths/components/storage-paths-manager";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/storage-paths")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: StoragePathsPage,
});

function StoragePathsPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Storage paths</h1>
        <p className="text-muted-foreground text-sm">
          Paths for filing documents (e.g. /Finance/2024). Descriptions help you and AI pick the
          right one.
        </p>
      </div>
      <StoragePathsManager orgId={orgId} />
    </div>
  );
}
