import { documentSearchSchema } from "./search-schema";
import type { DocumentSearch } from "./types";

// The search state the documents list was last showing, so leaving a document ("Back", or the
// post-delete redirect) returns to the exact filtered view the user came from — same role as
// Paperless's ComponentRouterService, collapsed to the one origin we have. Session-scoped per org
// (like the recent-tabs store): a fresh tab starts clean, a deep link falls back to the bare list.

const storageKey = (orgId: string) => `omnipaper.documents.lastSearch.${orgId}`;

export function saveLastListSearch(orgId: string, search: DocumentSearch) {
  try {
    sessionStorage.setItem(storageKey(orgId), JSON.stringify(search));
  } catch {
    // ignore write failures (private mode, quota) — worst case Back lands on the bare list
  }
}

export function getLastListSearch(orgId: string): DocumentSearch {
  try {
    const raw = sessionStorage.getItem(storageKey(orgId));
    if (raw) {
      // Re-validate through the route's own schema so a stale/corrupt entry can't produce a
      // search shape the list route wouldn't accept.
      return documentSearchSchema(JSON.parse(raw));
    }
  } catch {}
  return {};
}
