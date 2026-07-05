import { Button } from "@omnipaper/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";
import { PageLoader } from "@/components/page-loader";
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
    return <PageLoader />;
  }
  if (workflowId && !workflow) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangleIcon className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">Workflow not found</p>
          <p className="max-w-sm text-muted-foreground text-sm">
            This workflow may have been deleted or doesn't exist.
          </p>
        </div>
        <Button variant="outline" onClick={back} className="mt-2">
          Back to workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/dashboard/orgs/$orgId/workflows" params={{ orgId }}>
          <ArrowLeftIcon />
          Back
        </Link>
      </Button>
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
