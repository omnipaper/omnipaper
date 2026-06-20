import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { bootstrapDemoSession, configQueryOptions } from "@/features/auth/queries/config";
import { sessionKeys, sessionQueryOptions } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const config = await queryClient.ensureQueryData(configQueryOptions);
    let session = await queryClient.ensureQueryData(sessionQueryOptions);

    // In a public demo, "no session" means first visit — auto-log into the shared demo account
    // instead of bouncing to sign-in. If the bootstrap fails we fall through to the redirect, so
    // a misconfigured demo lands on /sign-in rather than looping.
    if (!session && config.demoMode) {
      await bootstrapDemoSession();
      await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      session = await queryClient.ensureQueryData(sessionQueryOptions);
    }

    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
