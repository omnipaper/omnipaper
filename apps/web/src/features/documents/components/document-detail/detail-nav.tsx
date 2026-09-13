import { Button } from "@omnipaper/ui/components/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { getLastListSearch } from "@/features/documents/filters/last-list-search";
import type { DocumentNavigation } from "@/features/documents/navigation/use-document-navigation";

type StepTarget = { id: string } | { home: true } | null;

function StepButton({
  orgId,
  target,
  label,
  children,
}: {
  orgId: string;
  target: StepTarget;
  label: string;
  children: ReactNode;
}) {
  if (!target) {
    return (
      <Button variant="outline" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon-sm" asChild aria-label={label} title={label}>
      {"home" in target ? (
        <Link to="/dashboard/orgs/$orgId" params={{ orgId }}>
          {children}
        </Link>
      ) : (
        <Link to="/dashboard/orgs/$orgId/documents/$id" params={{ orgId, id: target.id }}>
          {children}
        </Link>
      )}
    </Button>
  );
}

export function DetailNav({
  orgId,
  navigation,
}: {
  orgId: string;
  navigation: DocumentNavigation;
}) {
  const navigate = useNavigate();
  const backSearch = getLastListSearch(orgId);
  const { previousId, nextId, known } = navigation;
  const finishToHome = known && nextId === null;
  const next: StepTarget = nextId ? { id: nextId } : finishToHome ? { home: true } : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && previousId) {
        e.preventDefault();
        navigate({ to: "/dashboard/orgs/$orgId/documents/$id", params: { orgId, id: previousId } });
      } else if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        navigate({ to: "/dashboard/orgs/$orgId/documents/$id", params: { orgId, id: nextId } });
      } else if (e.key === "ArrowRight" && finishToHome) {
        e.preventDefault();
        navigate({ to: "/dashboard/orgs/$orgId", params: { orgId } });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, orgId, previousId, nextId, finishToHome]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        asChild
        aria-label="Close document"
        title="Back to documents"
      >
        <Link to="/dashboard/orgs/$orgId/documents" params={{ orgId }} search={backSearch}>
          <XIcon />
        </Link>
      </Button>
      <StepButton
        orgId={orgId}
        target={previousId ? { id: previousId } : null}
        label="Previous document"
      >
        <ChevronLeftIcon />
      </StepButton>
      <StepButton
        orgId={orgId}
        target={next}
        label={finishToHome ? "Done, back to Home" : "Next document"}
      >
        <ChevronRightIcon />
      </StepButton>
    </div>
  );
}
