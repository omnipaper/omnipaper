import { Badge } from "@omnipaper/ui/components/badge";
import { buttonVariants } from "@omnipaper/ui/components/button";
import { Switch } from "@omnipaper/ui/components/switch";
import { cn } from "@omnipaper/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, SparklesIcon } from "lucide-react";
import {
  type AiAssignField,
  aiAssignQuery,
  useSetAiAssignField,
} from "@/features/ai-assign/queries/ai-assign";

export function AiAssignMaster({
  orgId,
  field,
  label,
  variant = "switch",
}: {
  orgId: string;
  field: AiAssignField;
  label: string;
  variant?: "switch" | "button";
}) {
  const { data } = useQuery(aiAssignQuery({ orgId }));
  const set = useSetAiAssignField(orgId);
  const enabled = data?.fields[field]?.enabled ?? false;

  if (variant === "button") {
    return (
      <div
        className={cn(
          buttonVariants({ variant: enabled ? "default" : "outline", size: "default" }),
          "inline-flex h-7 items-stretch p-0",
          set.isPending && "pointer-events-none opacity-50",
        )}
      >
        <button
          type="button"
          aria-pressed={enabled}
          disabled={set.isPending}
          onClick={() => set.mutate({ field, enabled: !enabled })}
          className={cn(
            "inline-flex items-center gap-1 px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            enabled ? "rounded-l-md" : "rounded-md",
          )}
        >
          {enabled ? <CheckIcon /> : <SparklesIcon />}
          Let AI assign {label}
          <Badge
            variant={enabled ? "secondary" : "outline"}
            className={cn(
              "h-4 px-1.5 text-[0.625rem] uppercase tracking-wide",
              enabled &&
                "border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground",
            )}
          >
            {enabled ? "On" : "Off"}
          </Badge>
        </button>
        {enabled && data ? (
          <>
            <span className="w-px self-stretch bg-primary-foreground/20" aria-hidden="true" />
            <Link
              to="/dashboard/orgs/$orgId/workflows/$workflowId"
              params={{ orgId, workflowId: data.workflowId }}
              className="inline-flex items-center rounded-r-md px-2 outline-none hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Configure →
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <Switch
        checked={enabled}
        onCheckedChange={(on) => set.mutate({ field, enabled: on })}
        aria-label={`Let AI assign ${label}`}
      />
      <span className="text-muted-foreground">Let AI assign {label}</span>
      {enabled && data ? (
        <Link
          to="/dashboard/orgs/$orgId/workflows/$workflowId"
          params={{ orgId, workflowId: data.workflowId }}
          className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
        >
          Configure in the AI workflow →
        </Link>
      ) : null}
    </div>
  );
}
