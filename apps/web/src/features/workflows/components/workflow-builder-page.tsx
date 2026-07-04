import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import { orgTagsQuery } from "@/features/tags/queries/tags";
import { WorkflowBuilder } from "@/features/workflows/components/workflow-builder";
import { orgWorkflowsQuery } from "@/features/workflows/queries/workflows";

export function WorkflowBuilderPage({ orgId, workflowId }: { orgId: string; workflowId?: string }) {
  const navigate = useNavigate();
  const workflowsQuery = useQuery(orgWorkflowsQuery({ orgId }));
  const tagsQuery = useQuery(orgTagsQuery({ orgId }));
  const propsQuery = useQuery(orgPropertyDefinitionsQuery({ orgId }));

  const tags = tagsQuery.data?.tags ?? [];
  const properties = propsQuery.data?.definitions ?? [];
  const workflow = workflowId
    ? workflowsQuery.data?.workflows.find((w) => w.id === workflowId)
    : undefined;

  const back = () => navigate({ to: "/dashboard/orgs/$orgId/workflows", params: { orgId } });

  if (workflowId && workflowsQuery.isPending) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  if (workflowId && !workflow) {
    return <p className="text-muted-foreground text-sm">Workflow not found.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <WorkflowBuilder
        key={workflow?.id ?? "new"}
        orgId={orgId}
        tags={tags}
        properties={properties}
        workflow={workflow}
        onDone={back}
      />
    </div>
  );
}
