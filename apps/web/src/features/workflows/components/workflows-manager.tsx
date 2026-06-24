import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { orgTagsQuery } from "@/features/tags/queries/tags";
import { WorkflowBuilder } from "@/features/workflows/components/workflow-builder";
import { WorkflowCard } from "@/features/workflows/components/workflow-card";
import { orgWorkflowsQuery } from "@/features/workflows/queries/workflows";

export function WorkflowsManager({ orgId }: { orgId: string }) {
  const workflowsQuery = useQuery(orgWorkflowsQuery({ orgId }));
  const tagsQuery = useQuery(orgTagsQuery({ orgId }));

  const tags = tagsQuery.data?.tags ?? [];
  const workflows = workflowsQuery.data?.workflows ?? [];

  return (
    <div className="flex flex-col gap-6">
      <WorkflowBuilder orgId={orgId} tags={tags} />

      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {workflows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No workflows yet.</p>
          ) : (
            workflows.map((workflow) => (
              <WorkflowCard key={workflow.id} orgId={orgId} workflow={workflow} tags={tags} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
