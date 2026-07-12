import { documentSearchSchema } from "./search-schema";
import type { DocumentSearch } from "./types";

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
      return documentSearchSchema(JSON.parse(raw));
    }
  } catch {}
  return {};
}
