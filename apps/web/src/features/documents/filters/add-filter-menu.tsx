import { Button } from "@omnipaper/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import { PlusIcon } from "lucide-react";
import { DateFilterPicker } from "./date-filter-picker";
import type { FilterFieldDef, FilterState, FilterValue } from "./types";
export function AddFilterMenu({
  fields,
  filters,
  onChange,
}: {
  fields: FilterFieldDef[];
  filters: FilterState;
  onChange: (key: string, value: FilterValue | undefined) => void;
}) {
  const groups = new Map<string, FilterFieldDef[]>();
  for (const field of fields) {
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  function selectedFor(field: FilterFieldDef): Set<string> {
    const current = filters[field.key];
    return new Set(current?.kind === "in" ? current.values : []);
  }
  function toggle(field: FilterFieldDef, optValue: string) {
    const set = selectedFor(field);
    if (set.has(optValue)) {
      set.delete(optValue);
    } else {
      set.add(optValue);
    }
    onChange(field.key, set.size > 0 ? { kind: "in", values: [...set] } : undefined);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon />
          Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {[...groups.entries()].map(([group, groupFields], index) => (
          <DropdownMenuGroup key={group}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {group ? <DropdownMenuLabel>{group}</DropdownMenuLabel> : null}
            {groupFields.map((field) => {
              const Icon = field.icon;
              const selected = selectedFor(field);
              return (
                <DropdownMenuSub key={field.key}>
                  <DropdownMenuSubTrigger>
                    <Icon className="text-muted-foreground" />
                    {field.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className={
                      field.picker.kind === "dateRange" ? "w-48" : "max-h-72 w-48 overflow-y-auto"
                    }
                  >
                    {field.picker.kind === "dateRange" ? (
                      <DateFilterPicker
                        value={filters[field.key]}
                        onChange={(value) => onChange(field.key, value)}
                      />
                    ) : field.picker.options.length === 0 ? (
                      <DropdownMenuLabel>No options</DropdownMenuLabel>
                    ) : (
                      field.picker.options.map((opt) => (
                        <DropdownMenuCheckboxItem
                          key={opt.value}
                          checked={selected.has(opt.value)}
                          onCheckedChange={() => toggle(field, opt.value)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {opt.color ? (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                          ) : null}
                          <span className="truncate">{opt.label}</span>
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
