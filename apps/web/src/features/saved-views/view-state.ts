import type { SavedViewState } from "@omnipaper/shared/saved-views";
import type { DocumentSearch } from "@/features/documents/filters/types";

// Pull the persistable view state out of the live URL search, dropping the `savedView` pointer and
// any empty/default bits. This is what gets stored in a saved view and what a saved view applies.
export function extractViewState(search: DocumentSearch): SavedViewState {
  const state: SavedViewState = {};

  if (search.view) {
    state.view = search.view;
  }
  if (search.q?.trim()) {
    state.q = search.q.trim();
  }
  if (search.filters && Object.keys(search.filters).length > 0) {
    state.filters = search.filters;
  }
  if (search.sort) {
    state.sort = search.sort;
  }

  return state;
}

// Is there anything worth offering to save? (A bare gallery with no filters/sort/search isn't.)
export function hasSavableState(state: SavedViewState): boolean {
  return Boolean((state.filters && Object.keys(state.filters).length > 0) || state.sort || state.q);
}

// Stable string for dirty-detection: sort filter keys + each `in` filter's values so reordering
// never reads as a change, and normalize the default layout (`gallery`) so an absent vs explicit
// gallery compare equal.
export function viewStateKey(state: SavedViewState): string {
  const filters = state.filters ?? {};
  const normalizedFilters = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (value.kind === "in") {
        return [key, { kind: "in", values: [...value.values].sort() }] as const;
      }
      return [key, value] as const;
    });

  return JSON.stringify({
    view: state.view ?? "gallery",
    q: state.q ?? "",
    filters: normalizedFilters,
    sort: state.sort ?? null,
  });
}

export function isSameViewState(a: SavedViewState, b: SavedViewState): boolean {
  return viewStateKey(a) === viewStateKey(b);
}
