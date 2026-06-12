import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { MigrationWizard } from "@/features/migration/components/migration-wizard";
import { ensureOrgRole } from "@/features/organization/queries/organization";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/migration")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: MigrationPage,
});

function MigrationPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Migration</h1>
        <p className="text-muted-foreground text-sm">
          Import documents and metadata from another document system.
        </p>
      </div>
      <MigrationWizard orgId={orgId} />
    </div>
  );
}
