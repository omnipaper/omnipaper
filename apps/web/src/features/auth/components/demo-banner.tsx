import { DEMO_MODE } from "@/lib/demo-mode";

export function DemoBanner() {
  if (!DEMO_MODE) {
    return null;
  }

  return (
    <div className="shrink-0 border-amber-500/30 border-b bg-amber-500/15 px-4 py-2 text-center font-medium text-amber-700 text-sm dark:text-amber-400">
      You're viewing a read-only demo. Changes aren't saved.
    </div>
  );
}
