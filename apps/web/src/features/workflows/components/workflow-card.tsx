import { Button } from "@omnipaper/ui/components/button";
import { Switch } from "@omnipaper/ui/components/switch";
import { PencilIcon, Trash2Icon } from "lucide-react";
import {
  useDeleteWorkflow,
  useUpdateWorkflow,
  type Workflow,
} from "@/features/workflows/queries/workflows";

export function WorkflowCard({
  orgId,
  workflow,
  onEdit,
}: {
  orgId: string;
  workflow: Workflow;
  onEdit: (workflow: Workflow) => void;
}) {
  const update = useUpdateWorkflow(orgId);
  const remove = useDeleteWorkflow(orgId);
  const isSystem = workflow.systemKey !== null;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 truncate font-medium text-sm">{workflow.name}</div>
        <div className="flex shrink-0 items-center gap-3">
          {isSystem ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
              Built-in
            </span>
          ) : null}
          <Switch
            checked={workflow.enabled}
            onCheckedChange={(checked) =>
              update.mutate({ id: workflow.id, body: { enabled: checked } })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(workflow)}
            aria-label="Edit workflow"
          >
            <PencilIcon className="size-4" />
          </Button>
          {isSystem ? (
            <Button
              variant="ghost"
              size="sm"
              disabled
              aria-label="Built-in workflow, can't be deleted"
              title="Built-in workflow, can't be deleted"
            >
              <Trash2Icon className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate(workflow.id)}
              disabled={remove.isPending}
              aria-label="Delete workflow"
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
