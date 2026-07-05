import { Button } from "@omnipaper/ui/components/button";
import {
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/suggestions";

export function InlineSuggestion({
  orgId,
  documentId,
  suggestionId,
  label,
}: {
  orgId: string;
  documentId: string;
  suggestionId: string;
  label: string;
}) {
  const accept = useAcceptSuggestion(orgId, documentId);
  const dismiss = useDismissSuggestion(orgId, documentId);

  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">
        <span className="mr-1.5 font-medium text-primary">✨ Suggested:</span>
        {label}
      </span>
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-2 text-xs"
          onClick={() => accept.mutate(suggestionId)}
          disabled={accept.isPending}
        >
          Use
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-2 text-xs"
          onClick={() => dismiss.mutate(suggestionId)}
          disabled={dismiss.isPending}
          aria-label="Dismiss suggestion"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
