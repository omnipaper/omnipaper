import { useCallback, useSyncExternalStore } from "react";

export const DISPLAY_PROPERTY_KEYS = ["type", "date", "tags", "fileType", "created"] as const;
export type DisplayPropertyKey = (typeof DISPLAY_PROPERTY_KEYS)[number];

export const DISPLAY_PROPERTIES: { key: DisplayPropertyKey; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "date", label: "Date" },
  { key: "tags", label: "Tags" },
  { key: "fileType", label: "File type" },
  { key: "created", label: "Added" },
];

const DEFAULT_ENABLED: DisplayPropertyKey[] = ["type", "date", "tags"];
const DISPLAY_STORAGE_KEY = "omnipaper.documents.displayProperties";

const isKey = (value: string): value is DisplayPropertyKey =>
  (DISPLAY_PROPERTY_KEYS as readonly string[]).includes(value);

function load(): Set<DisplayPropertyKey> {
  try {
    const raw = localStorage.getItem(DISPLAY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(
          parsed.filter((v): v is DisplayPropertyKey => typeof v === "string" && isKey(v)),
        );
      }
    }
  } catch {}
  return new Set(DEFAULT_ENABLED);
}

// ── Shared store, so a toggle re-renders every reader ────────────────────────
// Plain useState would give the Display panel and the list rows each their OWN copy of this Set — so
// toggling in the panel wouldn't update the list (and a localStorage write doesn't notify the same
// tab). An external store read via useSyncExternalStore is one source of truth: every reader
// subscribes and a toggle notifies them all at once; the `storage` event also syncs other tabs.
// (This is the low-level primitive that state libraries like zustand/jotai are built on.)

const enabledListeners = new Set<() => void>();
// Cache the Set so getSnapshot returns a STABLE reference until a real change — handing
// useSyncExternalStore a fresh Set on every call would make it re-render in a loop.
let enabledCache: Set<DisplayPropertyKey> | null = null;
const SERVER_ENABLED = new Set(DEFAULT_ENABLED);

function getEnabled(): Set<DisplayPropertyKey> {
  if (enabledCache === null) {
    enabledCache = load();
  }
  return enabledCache;
}

function notifyEnabled() {
  for (const listener of enabledListeners) {
    listener();
  }
}

function subscribeEnabled(listener: () => void): () => void {
  enabledListeners.add(listener);
  return () => {
    enabledListeners.delete(listener);
  };
}

function toggleEnabled(key: DisplayPropertyKey) {
  const next = new Set(getEnabled());
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  enabledCache = next; // new reference → subscribers detect the change
  try {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // ignore storage write failures (private mode, quota) — the UI still reflects the change
  }
  notifyEnabled();
}

// Cross-tab sync: when displayProperties localStorage changes elsewhere, drop the cache + re-notify.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === DISPLAY_STORAGE_KEY) {
      enabledCache = null;
      notifyEnabled();
    }
  });
}

export function useDisplayProperties() {
  const enabled = useSyncExternalStore(subscribeEnabled, getEnabled, () => SERVER_ENABLED);
  const isOn = useCallback((key: DisplayPropertyKey) => enabled.has(key), [enabled]);
  const toggle = useCallback((key: DisplayPropertyKey) => toggleEnabled(key), []);
  return { isOn, toggle };
}
