import { filterStateSchema, sortStateSchema } from "@omnipaper/shared/document-filters";
import type { DocumentSearch } from "./types";

function coerce(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

export function documentSearchSchema(raw: Record<string, unknown>): DocumentSearch {
  const out: DocumentSearch = {};

  if (raw.view === "list" || raw.view === "gallery") {
    out.view = raw.view;
  }

  if (typeof raw.q === "string" && raw.q.length > 0) {
    out.q = raw.q;
  }

  const filters = filterStateSchema.safeParse(coerce(raw.filters));
  if (filters.success && Object.keys(filters.data).length > 0) {
    out.filters = filters.data;
  }

  const sort = sortStateSchema.safeParse(coerce(raw.sort));
  if (sort.success) {
    out.sort = sort.data;
  }

  if (typeof raw.savedView === "string" && raw.savedView.length > 0) {
    out.savedView = raw.savedView;
  }

  return out;
}
