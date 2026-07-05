import { createFileRoute, Outlet } from "@tanstack/react-router";

// Padding/scroll live here (not in the org layout) so they swap atomically with the page content —
// keying them off pathname in the parent caused a flash of unpadded content during navigation.
export const Route = createFileRoute("/dashboard/orgs/$orgId/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <Outlet />
    </div>
  );
}
