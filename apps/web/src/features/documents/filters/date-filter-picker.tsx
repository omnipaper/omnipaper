import { toISODate } from "@/lib/format";
import type { FilterValue } from "./types";
const PRESETS: {
    label: string;
    unit: "day" | "month" | "year";
    amount: number;
}[] = [
    { label: "1 day ago", unit: "day", amount: 1 },
    { label: "3 days ago", unit: "day", amount: 3 },
    { label: "1 week ago", unit: "day", amount: 7 },
    { label: "1 month ago", unit: "month", amount: 1 },
    { label: "3 months ago", unit: "month", amount: 3 },
    { label: "6 months ago", unit: "month", amount: 6 },
    { label: "1 year ago", unit: "year", amount: 1 },
];
function presetGte(unit: "day" | "month" | "year", amount: number): string {
    const date = new Date();
    if (unit === "day") {
        date.setDate(date.getDate() - amount);
    }
    else if (unit === "month") {
        date.setMonth(date.getMonth() - amount);
    }
    else {
        date.setFullYear(date.getFullYear() - amount);
    }
    return toISODate(date);
}
export function DateFilterPicker({ value, onChange, }: {
    value: FilterValue | undefined;
    onChange: (value: FilterValue | undefined) => void;
}) {
    const range = value?.kind === "dateRange" ? value : undefined;
    function update(which: "gte" | "lte", raw: string) {
        const next = {
            kind: "dateRange" as const,
            gte: range?.gte,
            lte: range?.lte,
            [which]: raw || undefined,
        };
        if (!next.gte && !next.lte) {
            onChange(undefined);
            return;
        }
        onChange(next);
    }
    return (<div className="flex flex-col">
      <div className="p-1">
        {PRESETS.map((preset) => (<button key={preset.label} type="button" onClick={() => onChange({ kind: "dateRange", gte: presetGte(preset.unit, preset.amount) })} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent">
            {preset.label}
          </button>))}
      </div>
      <div className="mx-1 my-1 h-px bg-border"/>
      <div className="flex flex-col gap-2 p-2">
        <label className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
          <span>From</span>
          <input type="date" value={range?.gte ?? ""} max={range?.lte} onChange={(event) => update("gte", event.target.value)} className="rounded-md border bg-transparent px-2 py-1 text-foreground text-xs"/>
        </label>
        <label className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
          <span>To</span>
          <input type="date" value={range?.lte ?? ""} min={range?.gte} onChange={(event) => update("lte", event.target.value)} className="rounded-md border bg-transparent px-2 py-1 text-foreground text-xs"/>
        </label>
      </div>
    </div>);
}
