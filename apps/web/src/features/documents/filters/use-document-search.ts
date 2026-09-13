import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { documentSearchSchema } from "./search-schema";
import type { DocumentSearch } from "./types";

// The non-strict hook returns whatever the current route declared, so re-parse it: routes that
// never declared these params (the header search renders everywhere) yield an empty DocumentSearch.
export function useDocumentSearch(): DocumentSearch {
  const raw = useSearch({ strict: false });
  return useMemo(() => documentSearchSchema(raw), [raw]);
}

export function useDocumentSearchPatch() {
  const navigate = useNavigate();
  return useCallback(
    (next: Partial<DocumentSearch>, options?: { push?: boolean }) => {
      navigate({
        to: ".",
        replace: !options?.push,
        search: (prev) => ({ ...documentSearchSchema(prev), ...next }),
      });
    },
    [navigate],
  );
}
