import type { FilterState, FilterValue, SortState } from "@omnipaper/shared/document-filters";
import type { ComponentType } from "react";

export type { FilterState, FilterValue, SortState };

export type FilterOption = { value: string; label: string; color?: string };

export type FilterFieldDef = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  picker: { kind: "in"; options: FilterOption[] } | { kind: "dateRange" };
};

export type DocumentView = "list" | "gallery";

export type DocumentSearch = {
  view?: DocumentView;
  q?: string;
  filters?: FilterState;
  sort?: SortState;
  savedView?: string;
};
