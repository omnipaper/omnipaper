import { createFileRoute, redirect } from "@tanstack/react-router";

// The org index has no content of its own — it sends you to the default view. Today that's the
// flat list; later this is where a per-user default view would be resolved.
export const Route = createFileRoute("/dashboard/orgs/$orgId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/orgs/$orgId/views/list",
      params: { orgId: params.orgId },
    });
  },
});
