import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { bootstrapDemoSession, syncDemoAccess } from "@/features/auth/demo-session";
import { sessionKeys, sessionQueryOptions } from "@/features/auth/queries/session";
import { DEMO_MODE } from "@/lib/demo-mode";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    let session = await queryClient.ensureQueryData(sessionQueryOptions);

    // In a public demo, "no session" means first visit — auto-log into the shared demo account
    // instead of bouncing to sign-in. If the bootstrap fails we fall through to the redirect, so
    // a misconfigured demo lands on /sign-in rather than looping.
    if (!session && DEMO_MODE) {
      await bootstrapDemoSession();
      // removeQueries, NOT invalidateQueries: the cached `null` has no active observers here, so
      // invalidate doesn't refetch and ensureQueryData would return the stale null from cache.
      queryClient.removeQueries({ queryKey: sessionKeys.all });
      session = await queryClient.ensureQueryData(sessionQueryOptions);
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
