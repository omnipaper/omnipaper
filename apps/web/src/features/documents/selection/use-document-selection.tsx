import { useSearch } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DocumentSearch } from "@/features/documents/filters/types";

type SelectionValue = {
  selectedIds: Set<string>;
  allSelected: boolean;
  count: number;
  hasSelection: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string, orderedIds: string[], shiftKey: boolean) => void;
  selectAllMatching: () => void;
  clear: () => void;
};

const DocumentSelectionContext = createContext<SelectionValue | null>(null);

export function DocumentSelectionProvider({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false }) as DocumentSearch;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [allSelected, setAllSelected] = useState(false);
  const anchorRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setSelectedIds(new Set());
    setAllSelected(false);
    anchorRef.current = null;
  }, []);

  const queryKey = JSON.stringify({
    q: search.q ?? "",
    filters: search.filters ?? null,
    sort: search.sort ?? null,
  });
  useEffect(() => {
    reset();
  }, [queryKey, reset]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        reset();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const value = useMemo<SelectionValue>(() => {
    return {
      selectedIds,
      allSelected,
      count: selectedIds.size,
      hasSelection: allSelected || selectedIds.size > 0,
      isSelected: (id) => allSelected || selectedIds.has(id),
      toggle(id, orderedIds, shiftKey) {
        setAllSelected(false);
        setSelectedIds((prev) => {
          const base = allSelected ? new Set(orderedIds) : new Set(prev);
          if (shiftKey && anchorRef.current) {
            const from = orderedIds.indexOf(anchorRef.current);
            const to = orderedIds.indexOf(id);
            if (from !== -1 && to !== -1) {
              const [lo, hi] = from <= to ? [from, to] : [to, from];
              for (let i = lo; i <= hi; i++) {
                const rangeId = orderedIds[i];
                if (rangeId) {
                  base.add(rangeId);
                }
              }
              return base;
            }
          }
          if (base.has(id)) {
            base.delete(id);
          } else {
            base.add(id);
          }
          anchorRef.current = id;
          return base;
        });
      },
      selectAllMatching() {
        setAllSelected(true);
      },
      clear: reset,
    };
  }, [selectedIds, allSelected, reset]);

  return (
    <DocumentSelectionContext.Provider value={value}>{children}</DocumentSelectionContext.Provider>
  );
}

export function useDocumentSelection() {
  const ctx = useContext(DocumentSelectionContext);
  if (!ctx) {
    throw new Error("useDocumentSelection must be used within a DocumentSelectionProvider");
  }
  return ctx;
}
