import { SaveViewButton } from "@/features/saved-views/components/save-view-button";
import { ActiveFilterChip } from "./active-filter-chip";
import { AddFilterMenu } from "./add-filter-menu";
import { DisplayPopover } from "./display-popover";
import { useDocumentFilterFields } from "./fields";
import { useDocumentFilters } from "./use-document-filters";

// The old FilterBar, split in two: the action buttons live in the page title row, the active
// chips render above the results. On the fileview route folder navigation owns the path scope,
// so the path field leaves both halves, and views are not saveable there.
export function FilterActions({ orgId, fileView = false }: { orgId: string; fileView?: boolean }) {
  const fields = useDocumentFilterFields(orgId);
  const { filters, sort, view, setValue, remove, setSort, setView } = useDocumentFilters();
  const visibleFields = fileView ? fields.filter((f) => f.key !== "path") : fields;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {fileView ? null : <SaveViewButton orgId={orgId} />}
      <AddFilterMenu
        fields={visibleFields}
        filters={filters}
        onChange={(key, value) => (value ? setValue(key, value) : remove(key))}
      />
      <DisplayPopover sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
    </div>
  );
}

export function ActiveFilterChips({
  orgId,
  fileView = false,
}: {
  orgId: string;
  fileView?: boolean;
}) {
  const fields = useDocumentFilterFields(orgId);
  const { filters, setValue, remove, clearAll } = useDocumentFilters();
  const visibleFields = fileView ? fields.filter((f) => f.key !== "path") : fields;
  const fieldByKey = new Map(visibleFields.map((f) => [f.key, f]));
  const activeEntries = Object.entries(filters).filter(([key]) => fieldByKey.has(key));

  if (activeEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <button
        type="button"
        onClick={clearAll}
        className="text-muted-foreground text-xs hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}
