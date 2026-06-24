import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import { orgTagsQuery } from "@/features/tags/queries/tags";
import { WorkflowBuilder } from "@/features/workflows/components/workflow-builder";
import { WorkflowCard } from "@/features/workflows/components/workflow-card";
import { orgWorkflowsQuery, type Workflow } from "@/features/workflows/queries/workflows";

export function WorkflowsManager({ orgId }: { orgId: string }) {
  const workflowsQuery = useQuery(orgWorkflowsQuery({ orgId }));
  const tagsQuery = useQuery(orgTagsQuery({ orgId }));
  const propsQuery = useQuery(orgPropertyDefinitionsQuery({ orgId }));

  const tags = tagsQuery.data?.tags ?? [];
  const properties = propsQuery.data?.definitions ?? [];
  const workflows = workflowsQuery.data?.workflows ?? [];

  // Editing reuses the builder: changing the key remounts it so its state re-inits from the prop.
  const [editing, setEditing] = useState<Workflow | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <WorkflowBuilder
        key={editing?.id ?? "new"}
        orgId={orgId}
        tags={tags}
        properties={properties}
        workflow={editing ?? undefined}
        onDone={() => setEditing(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {workflows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No workflows yet.</p>
          ) : (
            workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                orgId={orgId}
                workflow={workflow}
                tags={tags}
                onEdit={setEditing}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
