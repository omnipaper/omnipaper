import { Button } from "@omnipaper/ui/components/button";
import { CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import {
  type AiSuggestion,
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/documents";

const FIELD_LABEL: Record<AiSuggestion["field"], string> = {
  documentType: "Type",
  storagePath: "Path",
  documentDate: "Date",
  tags: "Tags",
  customProperty: "Property",
};

// Pending `suggest`-mode AI output, surfaced as confirmable chips above the metadata fields. "Use"
// applies the value server-side (then the detail refetches with the field set and the chip gone);
// dismiss drops it. Auto-mode results never appear here — they're already written.
export function AiSuggestionsPanel({
  orgId,
  documentId,
  suggestions,
}: {
  orgId: string;
  documentId: string;
  suggestions: AiSuggestion[];
}) {
  const accept = useAcceptSuggestion(orgId, documentId);
  const dismiss = useDismissSuggestion(orgId, documentId);

  if (suggestions.length === 0) {
    return null;
  }

  const busy = (id: string) =>
    (accept.isPending && accept.variables === id) ||
    (dismiss.isPending && dismiss.variables === id);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <h3 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        <SparklesIcon className="size-3.5 text-primary" />
        AI suggestions
      </h3>
      <ul className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">{FIELD_LABEL[suggestion.field]}: </span>
              <span className="font-medium">{suggestion.label}</span>
              {typeof suggestion.confidence === "number" ? (
                <span className="text-muted-foreground text-xs">
                  {" · "}
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              ) : null}
            </div>
            <Button
              size="xs"
              onClick={() => accept.mutate(suggestion.id)}
              disabled={busy(suggestion.id)}
            >
              <CheckIcon />
              Use
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Dismiss suggestion"
              onClick={() => dismiss.mutate(suggestion.id)}
              disabled={busy(suggestion.id)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
