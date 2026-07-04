import { isInstanceAdmin } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { AiSettingsForm } from "@/features/settings/components/ai-settings-form";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/ai")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);

    if (!isInstanceAdmin(session?.user?.role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: AiPage,
});

function AiPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">AI</h1>
        <p className="text-muted-foreground text-sm">
          Provider and model used by AI workflow actions.
        </p>
      </div>
      <AiSettingsForm />
    </div>
  );
}
