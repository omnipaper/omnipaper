import { Button } from "@omnipaper/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { aiAssignQuery } from "@/features/ai-assign/queries/ai-assign";

export function AiAssignWorkflowLink({
  orgId,
  variant = "link",
}: {
  orgId: string;
  variant?: "link" | "button";
}) {
  const { data } = useQuery(aiAssignQuery({ orgId }));

  if (!data || data.customFields.length === 0) {
    return null;
  }

  if (variant === "button") {
    return (
      <Button asChild>
        <Link
          to="/dashboard/orgs/$orgId/workflows/$workflowId"
          params={{ orgId, workflowId: data.workflowId }}
        >
          Configure →
        </Link>
      </Button>
    );
  }

  return (
    <Link
      to="/dashboard/orgs/$orgId/workflows/$workflowId"
      params={{ orgId, workflowId: data.workflowId }}
      className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
    >
      Configure in the AI workflow →
    </Link>
  );
}
