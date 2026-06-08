import { cn } from "@omnipaper/ui/lib/utils";
import { X } from "lucide-react";

type TagChipProps = {
  name: string;
  color: string;
  // When provided, renders a remove button. Omit for a read-only chip (e.g. in the document list).
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
};

// The tag's own color is shown as a small dot rather than the chip background, so arbitrary
// user-picked colors never fight the text for contrast.
export function TagChip({ name, color, onRemove, disabled, className }: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground",
        className,
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
          className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
