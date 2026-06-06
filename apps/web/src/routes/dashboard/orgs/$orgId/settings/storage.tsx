import { createFileRoute, redirect } from "@tanstack/react-router";
import { StorageSettingsForm } from "@/components/storage-settings-form";
import { isInstanceAdmin } from "@omnipaper/permissions";
import { sessionQueryOptions } from "@/lib/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/storage")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = isInstanceAdmin(session?.user?.role);

    if (!isAdmin) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: StoragePage,
});

function StoragePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Storage</h1>
        <p className="text-muted-foreground text-sm">
          S3-compatible bucket where your documents are stored.
        </p>
      </div>
      <StorageSettingsForm />
    </div>
  );
}
