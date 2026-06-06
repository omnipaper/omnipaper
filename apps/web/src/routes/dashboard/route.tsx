import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/lib/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await queryClient.ensureQueryData(sessionQueryOptions);

    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
