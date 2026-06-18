import { filterStateSchema, sortStateSchema } from "@omnipaper/shared/document-filters";
import type { DocumentSearch } from "./types";

// The single TanStack Router `validateSearch` for the unified documents page. `view` selects the
// layout (defaults to gallery at read time when absent); q/filters/sort carry the shared query.
// Invalid params are dropped rather than throwing, keeping a hand-edited URL from breaking the page.

function coerce(value: unknown): unknown {
  // The router may hand us either a parsed object or a JSON string, depending on how the URL was
  // produced; accept both so deep-links are robust.
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

  return out;
}
