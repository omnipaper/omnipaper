import { cn } from "@omnipaper/ui/lib/utils";
import {
  AlertTriangleIcon,
  BanIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  type LucideIcon,
} from "lucide-react";
import type { OcrStatus } from "@/features/documents/queries/documents";

type Config = { label: string; className: string; Icon: LucideIcon; spin?: boolean };

const CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    Icon: ClockIcon,
  },
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
  unsupported: {
    label: "Unsupported",
    className: "bg-muted text-muted-foreground",
    Icon: BanIcon,
  },
} satisfies Record<OcrStatus, Config>;

export function OcrStatusBadge({ status, className }: { status: OcrStatus; className?: string }) {
  const cfg: Config = CONFIG[status];
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
