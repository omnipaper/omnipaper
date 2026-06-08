import { cn } from "@omnipaper/ui/lib/utils";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  type LucideIcon,
} from "lucide-react";

type Config = { label: string; className: string; Icon: LucideIcon; spin?: boolean };

const PENDING: Config = {
  label: "Pending",
  className: "bg-muted text-muted-foreground",
  Icon: ClockIcon,
};

// Keyed by the documents.ocr_status enum. Unknown values fall back to PENDING.
const CONFIG: Record<string, Config> = {
  pending: PENDING,
  processing: {
    label: "Processing",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    Icon: Loader2Icon,
    spin: true,
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Icon: CheckIcon,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
    Icon: AlertTriangleIcon,
  },
};

export function OcrStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = CONFIG[status] ?? PENDING;
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs",
        cfg.className,
        className,
      )}
    >
      <Icon className={cn("size-3.5", cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
