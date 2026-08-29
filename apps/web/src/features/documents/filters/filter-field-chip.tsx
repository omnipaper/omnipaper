import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import { cn } from "@omnipaper/ui/lib/utils";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { summarizeFilterValue } from "./active-filter-chip";
import { DateFilterPicker } from "./date-filter-picker";
import { FilterValueList } from "./filter-value-list";
import type { FilterFieldDef, FilterValue } from "./types";

// A permanently visible filter chip (Drive-style): the field stays on screen whether set or not,
// the popover edits its value, and an active chip highlights and grows an X to clear it. Contrast
// with ActiveFilterChip, which only exists while its filter is set.
export function FilterFieldChip({
  field,
  value,
  onChange,
}: {
  field: FilterFieldDef;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = field.icon;
  const active = value !== undefined;
  const selected = value?.kind === "in" ? value.values : [];

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
    <span
      className={cn(
        "inline-flex items-center rounded-full border text-xs",
        active ? "border-foreground/20 bg-muted" : "border-border",
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 py-1.5 pl-3 hover:bg-accent",
              active ? "rounded-l-full pr-1.5" : "rounded-full pr-2.5",
            )}
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{field.label}</span>
            {active ? (
              <span className="font-medium">{summarizeFilterValue(field, value)}</span>
            ) : null}
            <ChevronDownIcon className="size-3 text-muted-foreground" />
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
      {active ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label={`Clear ${field.label} filter`}
          className="rounded-r-full py-1.5 pr-2.5 pl-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
