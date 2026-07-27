import { Button } from "@omnipaper/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getLastListSearch } from "@/features/documents/filters/last-list-search";
import { useDocumentNavigation } from "@/features/documents/navigation/use-document-navigation";

function StepButton({
  orgId,
  targetId,
  label,
  children,
}: {
  orgId: string;
  targetId: string | null;
  label: string;
  children: ReactNode;
}) {
  if (!targetId) {
    return (
      <Button variant="outline" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon-sm" asChild aria-label={label} title={label}>
      <Link to="/dashboard/orgs/$orgId/documents/$id" params={{ orgId, id: targetId }}>
        {children}
      </Link>
    </Button>
  );
}

// Close + step through the list without going back to it: the editing flow is "open, fix, next".
export function DetailNav({ orgId, id }: { orgId: string; id: string }) {
  const { previousId, nextId } = useDocumentNavigation({ orgId, id });
  const backSearch = getLastListSearch(orgId);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        asChild
        aria-label="Close document"
        title="Back to documents"
      >
        <Link to="/dashboard/orgs/$orgId/documents" params={{ orgId }} search={backSearch}>
          <XIcon />
        </Link>
      </Button>
      <StepButton orgId={orgId} targetId={previousId} label="Previous document">
        <ChevronLeftIcon />
      </StepButton>
      <StepButton orgId={orgId} targetId={nextId} label="Next document">
        <ChevronRightIcon />
      </StepButton>
    </div>
  );
}
