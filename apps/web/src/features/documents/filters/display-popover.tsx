import type { SortState } from "@omnipaper/shared/document-filters";
import { Button } from "@omnipaper/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { cn } from "@omnipaper/ui/lib/utils";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  LayoutGridIcon,
  ListIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DISPLAY_PROPERTIES, useDisplayProperties } from "./display-properties";
import { DEFAULT_ORDER, ORDERING_FIELDS } from "./fields";
import type { DocumentView } from "./types";

const VIEW_MODES: { mode: DocumentView; label: string; icon: typeof ListIcon }[] = [
  { mode: "list", label: "List", icon: ListIcon },
  { mode: "gallery", label: "Gallery", icon: LayoutGridIcon },
];

const GLASS =
  "dark relative w-64 animate-none! border-0 bg-popover/70 p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150";
export function DisplayPopover({
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  sort: SortState | undefined;
  onSortChange: (sort: SortState | undefined) => void;
  view: DocumentView;
  onViewChange: (view: DocumentView) => void;
}) {
  const { isOn, toggle } = useDisplayProperties();

  // The Select picks the field, the toggle picks the direction. With no sort set we show the
  // effective default (Added, descending) — getDocuments already orders that way — so there's no
  // "Default" entry to confuse anyone.
  const orderField = sort?.field ?? DEFAULT_ORDER.field;
  const orderDir = sort?.dir ?? DEFAULT_ORDER.dir;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontalIcon />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={GLASS}>
        <div className="flex flex-col gap-3">
          <Row label="Layout">
            <div className="flex items-center gap-0.5 rounded-md border border-foreground/10 p-0.5">
              {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === mode}
                  onClick={() => onViewChange(mode)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-[5px] transition-colors",
                    view === mode
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </Row>

          <Row label="Ordering">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onSortChange({ field: orderField, dir: orderDir === "asc" ? "desc" : "asc" })
                }
                aria-label={orderDir === "asc" ? "Ascending" : "Descending"}
                title={orderDir === "asc" ? "Ascending" : "Descending"}
                className="flex size-6 shrink-0 items-center justify-center rounded-md border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                {orderDir === "asc" ? (
                  <ArrowUpNarrowWideIcon className="size-3.5" />
                ) : (
                  <ArrowDownWideNarrowIcon className="size-3.5" />
                )}
              </button>
              <Select
                value={orderField}
                onValueChange={(field) => onSortChange({ field, dir: orderDir })}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDERING_FIELDS.map((option) => (
                    <SelectItem key={option.field} value={option.field}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Row>

          <div className="-mx-3 h-px bg-foreground/10" />

          <div>
            <p className="mb-2 text-muted-foreground text-xs">Display properties</p>
            <div className="flex flex-wrap gap-1.5">
              {DISPLAY_PROPERTIES.map((property) => (
                <button
                  key={property.key}
                  type="button"
                  onClick={() => toggle(property.key)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    isOn(property.key)
                      ? "border-foreground/20 bg-foreground/10 text-foreground"
                      : "border-foreground/10 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {property.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}
