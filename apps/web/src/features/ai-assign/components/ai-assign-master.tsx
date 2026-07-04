import { Switch } from "@omnipaper/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type AiAssignField,
  aiAssignQuery,
  useSetAiAssignField,
} from "@/features/ai-assign/queries/ai-assign";

export function AiAssignMaster({
  orgId,
  field,
  label,
}: {
  orgId: string;
  field: AiAssignField;
  label: string;
}) {
  const { data } = useQuery(aiAssignQuery({ orgId }));
  const set = useSetAiAssignField(orgId);
  const enabled = data?.fields[field]?.enabled ?? false;

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
