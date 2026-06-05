import { createFileRoute, redirect } from "@tanstack/react-router";
import { OcrSettingsForm } from "../../../../../components/ocr-settings-form";
import { queryClient } from "../../../../../lib/query-client";
import { sessionQueryOptions } from "../../../../../lib/session";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings/ocr")({
  beforeLoad: async ({ params }) => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);
    const isAdmin = session?.user?.role?.split(",").includes("admin") ?? false;

    if (!isAdmin) {
      throw redirect({ to: "/dashboard/orgs/$orgId/settings", params: { orgId: params.orgId } });
    }
  },
  component: OcrPage,
});

function OcrPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl">OCR</h1>
        <p className="text-muted-foreground text-sm">
          Text extraction provider used to process uploaded documents.
        </p>
      </div>
      <OcrSettingsForm />
    </div>
  );
}
