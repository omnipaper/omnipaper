import { Badge } from "@omnipaper/ui/components/badge";
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

type Config = {
  label: string;
  className: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  Icon: LucideIcon;
  spin?: boolean;
};

const CONFIG = {
  pending: {
    label: "Pending",
    className: "text-muted-foreground",
    variant: "secondary",
    Icon: ClockIcon,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    variant: "secondary",
    Icon: Loader2Icon,
    spin: true,
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent",
    variant: "outline",
    Icon: CheckIcon,
  },
  failed: {
    label: "Failed",
    className: "",
    variant: "destructive",
    Icon: AlertTriangleIcon,
  },
  unsupported: {
    label: "Unsupported",
    className: "text-muted-foreground",
    variant: "secondary",
    Icon: BanIcon,
  },
} satisfies Record<OcrStatus, Config>;

export function OcrStatusBadge({ status, className }: { status: OcrStatus; className?: string }) {
  const cfg: Config = CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant} className={cn(cfg.className, className)}>
      <Icon className={cn("size-3.5", cfg.spin && "animate-spin")} />
      {cfg.label}
    </Badge>
  );
}
