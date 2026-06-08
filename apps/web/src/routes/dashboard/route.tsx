import { sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

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
