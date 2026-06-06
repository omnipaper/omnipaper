import { createFileRoute, redirect } from "@tanstack/react-router";
import { OrgGeneralForm } from "@/components/org-general-form";
import { ensureOrgRole } from "@/lib/queries/organization";
import { canManageOrg } from "@omnipaper/permissions";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/general")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: GeneralPage,
});

function GeneralPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">General</h1>
        <p className="text-muted-foreground text-sm">Organization settings.</p>
      </div>
      <OrgGeneralForm orgId={orgId} />
    </div>
  );
}
