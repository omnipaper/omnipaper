import { DocumentTypesManager } from "@/features/document-types/components/document-types-manager";
import { ensureOrgRole } from "@/features/organization/queries/organization";
import { canManageOrg } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/document-types")({
  beforeLoad: async ({ params }) => {
    const role = await ensureOrgRole(params.orgId);

    if (!canManageOrg(role)) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: DocumentTypesPage,
});

function DocumentTypesPage() {
  const { orgId } = Route.useParams();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">Document types</h1>
        <p className="text-muted-foreground text-sm">
          Categories you assign to documents. A description helps you (and, later, automatic
          classification) decide when each type applies.
        </p>
      </div>
      <DocumentTypesManager orgId={orgId} />
    </div>
  );
}
