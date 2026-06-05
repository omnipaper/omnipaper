import { createFileRoute, redirect } from "@tanstack/react-router";
import { OrgGeneralForm } from "../../../../../components/org-general-form";
import { authClient } from "../../../../../lib/auth-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/general")({
  beforeLoad: async ({ params }) => {
    const { data: member } = await authClient.organization.getActiveMember();
    const roles = (member?.role ?? "").split(",");

    if (!roles.includes("owner") && !roles.includes("admin")) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: GeneralPage,
});

function GeneralPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">General</h1>
        <p className="text-muted-foreground text-sm">Organization settings.</p>
      </div>
      <OrgGeneralForm />
    </div>
  );
}
