import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureOrgRole } from "@/features/organization/queries/organization";
import { AutomationSettingsForm } from "@/features/workflows/components/automation-settings-form";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/automation")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: AutomationPage,
});

function AutomationPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Automation</h1>
        <p className="text-muted-foreground text-sm">
          Let AI organize documents as they're added. Choose which metadata it fills and whether to
          apply it automatically or suggest it for review.
        </p>
      </div>
      <AutomationSettingsForm orgId={orgId} />
    </div>
  );
}
