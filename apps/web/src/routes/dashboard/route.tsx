import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient } from "../../lib/query-client";
import { sessionQueryOptions } from "../../lib/session";

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
