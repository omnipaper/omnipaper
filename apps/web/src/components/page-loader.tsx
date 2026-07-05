import { Loader2Icon } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] w-full flex-1 flex-col items-center justify-center gap-3">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground/50" />
      <span className="text-muted-foreground text-sm">Loading...</span>
    </div>
  );
}
