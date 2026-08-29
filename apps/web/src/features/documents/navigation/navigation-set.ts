// The explicit queue behind "Open" on the selection bar: document ids to step through in the
// detail view, in list order. Session-scoped like lastListSearch. Every collection page clears
// it, so a stale queue can never hijack prev/next for a document opened by a plain click later.
const storageKey = (orgId: string) => `omnipaper.documents.navigationSet.${orgId}`;

export function saveNavigationSet(orgId: string, ids: string[]) {
  try {
    sessionStorage.setItem(storageKey(orgId), JSON.stringify(ids));
  } catch {
    // ignore write failures (private mode, quota) — prev/next falls back to the list order
  }
}

export function getNavigationSet(orgId: string): string[] {
  try {
    const raw = sessionStorage.getItem(storageKey(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    }
  } catch {}
  return [];
}

export function removeFromNavigationSet(orgId: string, id: string) {
  const next = getNavigationSet(orgId).filter((v) => v !== id);
  if (next.length > 0) {
    saveNavigationSet(orgId, next);
  } else {
    clearNavigationSet(orgId);
  }
}

export function clearNavigationSet(orgId: string) {
  try {
    sessionStorage.removeItem(storageKey(orgId));
  } catch {}
}
