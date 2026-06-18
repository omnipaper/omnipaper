import { useCallback, useSyncExternalStore } from "react";

// The documents a user has open this session, shown as closeable "tabs" in the sidebar. SESSION
// scoped: kept in sessionStorage so the list survives a reload but dies with the tab / on browser
// restart — these are the docs you're working on right now, not a durable history. Keyed per org
// because documents are org-scoped and the URL's orgId is the source of truth. We store only what the
// sidebar renders ({ id, title }) — no date/type/mime, on purpose.

export type RecentDocument = { id: string; title: string };

const MAX_RECENT = 5;
const storageKey = (orgId: string) => `omnipaper.documents.recent.${orgId}`;

function load(orgId: string): RecentDocument[] {
  try {
    const raw = sessionStorage.getItem(storageKey(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (e): e is RecentDocument => typeof e?.id === "string" && typeof e?.title === "string",
          )
          .slice(0, MAX_RECENT);
      }
    }
  } catch {}
  return [];
}

// ── Shared store, so the "opened" effect (in the detail page) and the sidebar list re-render together.
// Same primitive as useDisplayProperties — a module-level cache read through useSyncExternalStore —
// but keyed per org. getSnapshot must return a STABLE array reference until THAT org's list actually
// changes, or useSyncExternalStore loops; so we cache per org in a Map and only swap the mutated org's
// array. No `storage` event listener here: sessionStorage is per-tab, so there's no other tab sharing
// this list to sync with — within-tab updates come from the listener set below.

const listeners = new Set<() => void>();
const cache = new Map<string, RecentDocument[]>();
const EMPTY: RecentDocument[] = [];

function getList(orgId: string): RecentDocument[] {
  let list = cache.get(orgId);
  if (!list) {
    list = load(orgId);
    cache.set(orgId, list);
  }
  return list;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(orgId: string, list: RecentDocument[]) {
  cache.set(orgId, list); // new reference → subscribers detect the change
  try {
    sessionStorage.setItem(storageKey(orgId), JSON.stringify(list));
  } catch {
    // ignore write failures (private mode, quota) — the in-memory list still drives the UI
  }
  notify();
}

export function pushRecent(orgId: string, entry: RecentDocument) {
  const list = getList(orgId);
  // Already a tab → leave it where it is. Tabs hold their position; we don't reorder on revisit.
  if (list.some((e) => e.id === entry.id)) {
    return;
  }
  // Newest on top; oldest falls off once we're over the cap.
  write(orgId, [entry, ...list].slice(0, MAX_RECENT));
}

export function removeRecent(orgId: string, id: string) {
  const list = getList(orgId);
  const next = list.filter((e) => e.id !== id);
  if (next.length !== list.length) {
    write(orgId, next);
  }
}

export function useRecentDocuments(orgId: string): RecentDocument[] {
  const getSnapshot = useCallback(() => getList(orgId), [orgId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
