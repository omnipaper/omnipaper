import { Button } from "@omnipaper/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { orgTagsQuery } from "@/features/tags/queries/tags";
import { WorkflowCard } from "@/features/workflows/components/workflow-card";
import { orgWorkflowsQuery } from "@/features/workflows/queries/workflows";

export function WorkflowsList({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const workflowsQuery = useQuery(orgWorkflowsQuery({ orgId }));
  const tagsQuery = useQuery(orgTagsQuery({ orgId }));

  const tags = tagsQuery.data?.tags ?? [];
  const workflows = [...(workflowsQuery.data?.workflows ?? [])].sort(
    (a, b) => Number(b.systemKey !== null) - Number(a.systemKey !== null),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            navigate({ to: "/dashboard/orgs/$orgId/workflows/new", params: { orgId } })
          }
        >
          <PlusIcon />
          New workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No workflows yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              orgId={orgId}
              workflow={workflow}
              tags={tags}
              onEdit={(w) =>
                navigate({
                  to: "/dashboard/orgs/$orgId/workflows/$workflowId",
                  params: { orgId, workflowId: w.id },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
