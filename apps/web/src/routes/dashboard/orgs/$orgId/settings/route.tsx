import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/orgs/$orgId/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="p-6">
      <Outlet />
    </div>
  );
}
