import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { formatCalendarDate } from "@/lib/format";
import { DateFilterPicker } from "./date-filter-picker";
import { FilterValueList } from "./filter-value-list";
import type { FilterFieldDef, FilterValue } from "./types";

function summarize(field: FilterFieldDef, value: FilterValue): string {
  if (value.kind === "in") {
    const options = field.picker.kind === "in" ? field.picker.options : [];
    const labels = value.values.map((v) => options.find((o) => o.value === v)?.label ?? v);
    if (labels.length <= 2) {
      return labels.join(", ");
    }
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }
  if (value.kind === "dateRange") {
    if (value.gte && value.lte) {
      return `${formatCalendarDate(value.gte)} → ${formatCalendarDate(value.lte)}`;
    }
    if (value.gte) {
      return `Since ${formatCalendarDate(value.gte)}`;
    }
    if (value.lte) {
      return `Before ${formatCalendarDate(value.lte)}`;
    }
  }
  return "";
}
export function ActiveFilterChip({
  field,
  value,
  onChange,
  onRemove,
}: {
  field: FilterFieldDef;
  value: FilterValue;
  onChange: (value: FilterValue | undefined) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = field.icon;
  const selected = value.kind === "in" ? value.values : [];
  function toggle(optValue: string) {
    const set = new Set(selected);
    if (set.has(optValue)) {
      set.delete(optValue);
    } else {
      set.add(optValue);
    }
    onChange(set.size > 0 ? { kind: "in", values: [...set] } : undefined);
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted text-xs">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-l-full py-1 pr-1.5 pl-2.5 hover:bg-accent"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{field.label}</span>
            <span className="font-medium">{summarize(field, value)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          {field.picker.kind === "dateRange" ? (
            <DateFilterPicker value={value} onChange={onChange} />
          ) : (
            <FilterValueList options={field.picker.options} selected={selected} onToggle={toggle} />
          )}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${field.label} filter`}
        className="rounded-r-full py-1 pr-2 pl-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}
