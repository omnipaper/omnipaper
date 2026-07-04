import { DEMO_MODE, useDemoReadOnly } from "@/lib/demo-mode";

export function DemoBanner() {
  const readOnly = useDemoReadOnly();

  if (!DEMO_MODE) {
    return null;
  }

  if (!readOnly) {
    return (
      <div className="shrink-0 border-sky-500/30 border-b bg-sky-500/15 px-4 py-2 text-center font-medium text-sky-700 text-sm dark:text-sky-400">
        Curator session — your changes are live for every demo visitor.
      </div>
    );
  }

  return (
    <div className="shrink-0 border-amber-500/30 border-b bg-amber-500/15 px-4 py-2 text-center font-medium text-amber-700 text-sm dark:text-amber-400">
      You're viewing a read-only demo. Changes aren't saved.
    </div>
  );
}
