import type { FilterValue, SortState } from "@omnipaper/shared/document-filters";
import type { DocumentView } from "./types";
import { useDocumentSearch, useDocumentSearchPatch } from "./use-document-search";

// Ergonomic read/write layer over the URL filter+sort state. Route-agnostic (uses the non-strict
// hooks) so the same bar works on list/folders/gallery. The URL stays the single source of truth;
// every mutation merges into the existing search and replaces history (no back-button spam).
export function useDocumentFilters() {
  const search = useDocumentSearch();
  const patch = useDocumentSearchPatch();

  const filters = search.filters ?? {};
  const sort = search.sort;
  const view = search.view ?? "gallery";

  return {
    filters,
    sort,
    view,
    setValue(key: string, value: FilterValue) {
      patch({ filters: { ...filters, [key]: value } });
    },
    remove(key: string) {
      const rest = { ...filters };
      delete rest[key];
      patch({ filters: Object.keys(rest).length > 0 ? rest : undefined });
    },
    setSort(next: SortState | undefined) {
      patch({ sort: next });
    },
    setView(next: DocumentView) {
      patch({ view: next });
    },
    clearAll() {
      patch({ filters: undefined, sort: undefined });
    },
  };
}
