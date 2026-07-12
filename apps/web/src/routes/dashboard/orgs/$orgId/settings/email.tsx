import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { EmailIngestManager } from "@/features/email-ingest/components/email-ingest-manager";
import { ensureOrgRole } from "@/features/organization/queries/organization";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/email")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: EmailPage,
});

function EmailPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Email intake</h1>
        <p className="text-muted-foreground text-sm">
          Connect mailboxes and ingest email attachments as documents.
        </p>
      </div>
      <EmailIngestManager orgId={orgId} />
    </div>
  );
}
