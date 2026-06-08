import { isInstanceAdmin } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { RegistrationSettingsForm } from "@/features/settings/components/registration-settings-form";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/registration")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = isInstanceAdmin(session?.user?.role);

    if (!isAdmin) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: RegistrationPage,
});

function RegistrationPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Registration</h1>
        <p className="text-muted-foreground text-sm">
          Control whether new accounts can be created from the public sign-up page.
        </p>
      </div>
      <RegistrationSettingsForm />
    </div>
  );
}
