import { Input } from "@omnipaper/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import { cn } from "@omnipaper/ui/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

export type ComboboxItem = { id: string; label: string };

type Props = {
  items: ComboboxItem[];
  value: string | null;
  onSelect: (id: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  // Create affordance — only rendered when `canCreate` and `onCreate` are both set. The parent owns
  // the create mutation and is responsible for selecting the new item once the POST resolves.
  canCreate?: boolean;
  onCreate?: (input: string) => void;
  // Gate the "Create" row on a valid input (e.g. a path regex). Defaults to "non-empty".
  validateCreate?: (input: string) => boolean;
  createLabel?: (input: string) => string;
  // Disable writes while a select/create is in flight, mirroring TagPicker's pending guard.
  pending?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  // e.g. "font-mono" for storage paths.
  itemClassName?: string;
  triggerId?: string;
  "aria-label"?: string;
};

// Single-select dropdown with an inline "Create …" row — the searchable, creatable counterpart to a
// plain Select. Generalizes the popover-combobox pattern hand-rolled in TagPicker (multi-select).
export function CreatableCombobox({
  items,
  value,
  onSelect,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No matches.",
  canCreate = false,
  onCreate,
  validateCreate,
  createLabel = (input) => `Create “${input}”`,
  pending = false,
  allowClear = true,
  clearLabel = "— None —",
  itemClassName,
  triggerId,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = items.find((i) => i.id === value) ?? null;
  const query = search.trim();
  const q = query.toLowerCase();
  const filtered = items.filter((i) => i.label.toLowerCase().includes(q));

  const inputValid = validateCreate ? validateCreate(query) : query.length > 0;
  const exists = items.some((i) => i.label.toLowerCase() === q);
  const showCreate = canCreate && !!onCreate && query.length > 0 && inputValid && !exists;

  function close() {
    setOpen(false);
    setSearch("");
  }

  function pick(id: string | null) {
    onSelect(id);
    close();
  }

  function create() {
    if (!onCreate || !showCreate || pending) {
      return;
    }
    onCreate(query);
    // Parent selects the new item once its POST resolves; just close + reset here.
    close();
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={triggerId}
          aria-label={ariaLabel}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span className={cn("truncate", selected ? itemClassName : "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-48 p-0">
        <div className="p-1">
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && showCreate) {
                e.preventDefault();
                create();
              }
            }}
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {allowClear ? (
            <button
              type="button"
              onClick={() => pick(null)}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex-1 truncate">{clearLabel}</span>
              {value === null ? <CheckIcon className="size-3.5" /> : null}
            </button>
          ) : null}

          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item.id)}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <span className={cn("flex-1 truncate", itemClassName)}>{item.label}</span>
              {item.id === value ? <CheckIcon className="size-3.5 text-muted-foreground" /> : null}
            </button>
          ))}

          {showCreate ? (
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{createLabel(query)}</span>
            </button>
          ) : null}

          {filtered.length === 0 && !showCreate ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">{emptyLabel}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
