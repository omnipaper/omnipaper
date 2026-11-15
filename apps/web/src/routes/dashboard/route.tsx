import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { bootstrapDemoSession, syncDemoAccess } from "@/features/auth/demo-session";
import { sessionKeys, sessionQueryOptions } from "@/features/auth/queries/session";
import { DEMO_MODE } from "@/lib/demo-mode";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    let session = await queryClient.query({ ...sessionQueryOptions, staleTime: "static" });

    // In the demo, no session means a first visit: log into the shared account. On failure fall
    // through to the redirect, so a broken demo lands on /sign-in instead of looping.
    if (!session && DEMO_MODE) {
      await bootstrapDemoSession();
      // removeQueries: the cached null has no observers, so invalidate wouldn't refetch it.
      queryClient.removeQueries({ queryKey: sessionKeys.all });
      session = await queryClient.query({ ...sessionQueryOptions, staleTime: "static" });
    }

    if (!session) {
      throw redirect({ to: "/sign-in" });
    }

    if (DEMO_MODE) {
      await syncDemoAccess(session.user.email);
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
