import { ActiveFilterChip } from "./active-filter-chip";
import { AddFilterMenu } from "./add-filter-menu";
import { DisplayPopover } from "./display-popover";
import { useDocumentFilterFields } from "./fields";
import { useDocumentFilters } from "./use-document-filters";

export function FilterBar({ orgId }: { orgId: string }) {
  const fields = useDocumentFilterFields(orgId);
  const { filters, sort, view, setValue, remove, setSort, setView, clearAll } =
    useDocumentFilters();

  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const activeEntries = Object.entries(filters);

  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {activeEntries.map(([key, value]) => {
          const field = fieldByKey.get(key);
          if (!field) {
            return null;
          }
          return (
            <ActiveFilterChip
              key={key}
              field={field}
              value={value}
              onChange={(next) => (next ? setValue(key, next) : remove(key))}
              onRemove={() => remove(key)}
            />
          );
        })}
        {activeEntries.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <AddFilterMenu
          fields={fields}
          filters={filters}
          onChange={(key, value) => (value ? setValue(key, value) : remove(key))}
        />
        <DisplayPopover sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      </div>
    </div>
  );
}
