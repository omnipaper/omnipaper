import { useDemoMode } from "@/features/auth/queries/config";

// Thin always-on bar shown only on a read-only demo instance. It frames the experience so the
// occasional blocked-write toast reads as intentional rather than a bug.
export function DemoBanner() {
  const isDemo = useDemoMode();

  if (!isDemo) {
    return null;
  }

  return (
    <div className="shrink-0 border-amber-500/30 border-b bg-amber-500/15 px-4 py-2 text-center font-medium text-amber-700 text-sm dark:text-amber-400">
      You're viewing a read-only demo — changes aren't saved.
    </div>
  );
}
