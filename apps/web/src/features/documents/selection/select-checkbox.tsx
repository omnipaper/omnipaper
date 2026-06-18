import { cn } from "@omnipaper/ui/lib/utils";
import { CheckIcon } from "lucide-react";

// A small selection checkbox used in list rows and gallery cards. Both are links to the document, so
// it swallows the click (preventDefault + stopPropagation) and never navigates — only selects. The
// click's shiftKey is forwarded so callers can do range selection.
export function SelectCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: (shiftKey: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-foreground/40",
      )}
    >
      {checked ? <CheckIcon className="size-3" /> : null}
    </button>
  );
}
