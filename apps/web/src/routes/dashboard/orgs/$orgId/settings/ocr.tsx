import { isInstanceAdmin } from "@omnipaper/permissions";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries/session";
import { OcrSettingsForm } from "@/features/settings/components/ocr-settings-form";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/ocr")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = isInstanceAdmin(session?.user?.role);

    if (!isAdmin) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: OcrPage,
});

function OcrPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">OCR</h1>
        <p className="text-muted-foreground text-sm">
          Text extraction engine used to process uploaded documents.
        </p>
      </div>
      <OcrSettingsForm />
    </div>
  );
}
