import { Input } from "@omnipaper/ui/components/input";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import type { FilterOption } from "./types";

export function FilterValueList({
  options,
  selected,
  onToggle,
}: {
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const selectedSet = new Set(selected);

  return (
    <div>
      <div className="p-1">
        <Input
          autoFocus
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {filtered.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            {opt.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
            ) : null}
            <span className="flex-1 truncate">{opt.label}</span>
            {selectedSet.has(opt.value) ? (
              <CheckIcon className="size-3.5 text-muted-foreground" />
            ) : null}
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No options.</p>
        ) : null}
      </div>
    </div>
  );
}
