import { Button } from "@omnipaper/ui/components/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@omnipaper/ui/components/hover-card";
import { CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import {
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/suggestions";

// A "Suggestions" pill next to the field label; hovering it reveals the proposed value and the
// actions. Nothing in the form layout changes when the suggestion is resolved.
export function InlineSuggestion({
  orgId,
  documentId,
  suggestionId,
  label,
  fieldLabel,
  current,
  isNew,
}: {
  orgId: string;
  documentId: string;
  suggestionId: string;
  label: string;
  fieldLabel: string;
  current?: string | null;
  // The value would be created on apply (allowNew), not picked from existing ones.
  isNew?: boolean;
}) {
  const accept = useAcceptSuggestion(orgId, documentId);
  const dismiss = useDismissSuggestion(orgId, documentId);

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`AI suggestions for ${fieldLabel}`}
          className="-my-0.5 inline-flex h-6 items-center gap-1 rounded-2xl bg-primary/10 px-2 font-medium text-primary text-xs transition-colors hover:bg-primary/20"
        >
          <SparklesIcon className="size-3.5" />
          Suggestions
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-52 gap-2 rounded-2xl p-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="break-words rounded-2xl bg-input/50 px-2.5 py-1.5 font-medium text-sm leading-tight">
            {label}
            {isNew ? (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-px align-middle font-medium text-[10px] text-primary uppercase">
                new
              </span>
            ) : null}
          </span>
          {current ? (
            <span className="text-muted-foreground text-xs">
              Replaces <span className="line-through">{current}</span>
            </span>
          ) : null}
        </div>
        <div className="flex gap-1">
          <Button
            size="xs"
            className="flex-1"
            onClick={() => accept.mutate(suggestionId)}
            disabled={accept.isPending}
          >
            <CheckIcon />
            Apply
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="flex-1"
            onClick={() => dismiss.mutate(suggestionId)}
            disabled={dismiss.isPending}
          >
            <XIcon />
            Reject
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
