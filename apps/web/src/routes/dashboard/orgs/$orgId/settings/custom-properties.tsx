import { CustomPropertiesManager } from "@/components/custom-properties-manager";
import { ensureOrgRole } from "@/lib/queries/organization";
import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/custom-properties")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: CustomPropertiesPage,
});

function CustomPropertiesPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Custom properties</h1>
        <p className="text-muted-foreground text-sm">Define the fields documents can carry.</p>
      </div>
      <CustomPropertiesManager orgId={orgId} />
    </div>
  );
}
