import { Badge } from "@omnipaper/ui/components/badge";
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

function contrastText(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#000000" : "#ffffff";
}

export function TagChip({ name, color, onRemove, disabled, className }: TagChipProps) {
  return (
    <Badge
      className={cn("h-auto border-transparent py-0.5 font-normal text-xs", className)}
      style={{ backgroundColor: color, color: contrastText(color) }}
    >
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
          className="-mr-0.5 rounded-full p-0.5 opacity-70 hover:bg-black/15 hover:opacity-100 disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </Badge>
  );
}
