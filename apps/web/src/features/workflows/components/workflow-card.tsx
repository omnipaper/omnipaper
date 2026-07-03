import { TRIGGER_DEFINITIONS, type TriggerId } from "@omnipaper/shared/workflows/triggers";
import { Button } from "@omnipaper/ui/components/button";
import { Switch } from "@omnipaper/ui/components/switch";
import {
  ChevronRightIcon,
  PencilIcon,
  SparklesIcon,
  TagIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OrgTag } from "@/features/tags/queries/tags";
import {
  useDeleteWorkflow,
  useUpdateWorkflow,
  type Workflow,
} from "@/features/workflows/queries/workflows";

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
      {icon}
      {children}
    </span>
  );
}

export function WorkflowCard({
  orgId,
  workflow,
  tags,
  onEdit,
}: {
  orgId: string;
  workflow: Workflow;
  tags: OrgTag[];
  onEdit: (workflow: Workflow) => void;
}) {
  const update = useUpdateWorkflow(orgId);
  const remove = useDeleteWorkflow(orgId);
  const isSystem = workflow.systemKey !== null;

  const triggerLabel =
    TRIGGER_DEFINITIONS[workflow.triggerType as TriggerId]?.label ?? workflow.triggerType;
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? "unknown tag";

  function actionLabel(action: Workflow["definition"]["actions"][number]): string {
    if (action.type === "ai.assignMetadata") {
      const fields = Object.keys(action.config);
      return `AI: ${fields.length > 0 ? fields.join(", ") : "assign metadata"}`;
    }
    const verb = action.type === "tag.remove" ? "Remove tag" : "Add tag";
    return `${verb}: ${tagName(action.config.tagId)}`;
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-medium text-sm">{workflow.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip icon={<ZapIcon className="size-3" />}>{triggerLabel}</Chip>
            {workflow.definition.actions.map((action) => (
              <span key={action.id} className="flex items-center gap-1.5">
                <ChevronRightIcon className="size-3 text-muted-foreground" />
                <Chip
                  icon={
                    action.type === "ai.assignMetadata" ? (
                      <SparklesIcon className="size-3" />
                    ) : (
                      <TagIcon className="size-3" />
                    )
                  }
                >
                  {actionLabel(action)}
                </Chip>
              </span>
            ))}
          </div>
        </div>
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
