import { isInstanceAdmin } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { EmailInstanceSettingsCard } from "@/features/email-ingest/components/email-instance-settings-card";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/email-instance")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = isInstanceAdmin(session?.user?.role);

    if (!isAdmin) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: EmailInstancePage,
});

function EmailInstancePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Email</h1>
        <p className="text-muted-foreground text-sm">
          Instance-wide rules for email ingestion connections.
        </p>
      </div>
      <EmailInstanceSettingsCard />
    </div>
  );
}
