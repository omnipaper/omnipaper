import { Input } from "@omnipaper/ui/components/input";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { UploadButton } from "@/features/documents/components/upload-button";
import { FilterBar } from "@/features/documents/filters/filter-bar";
import type { DocumentSearch } from "@/features/documents/filters/types";

// The shared chrome of the documents page: title + upload, the search box, and the filter bar (which
// also holds the Display popover with the layout toggle) — declared once, around whatever body
// (list/gallery) the route renders. Mirrors Paperless's single filter editor outside the display-mode
// branches: switching layout never remounts these, so search/filters/sort survive.
export function DocumentsShell({ orgId, children }: { orgId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DocumentSearch;
  const [text, setText] = useState(search.q ?? "");

  // Debounce the search box into the URL `q` (the single source of truth the results read back).
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate({
        to: ".",
        replace: true,
        search: (prev) => ({ ...(prev as DocumentSearch), q: text.trim() || undefined }),
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [text, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Documents</h1>
        <UploadButton orgId={orgId} />
      </div>
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          placeholder="Search documents…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <FilterBar orgId={orgId} />
        {children}
      </div>
    </div>
  );
}
