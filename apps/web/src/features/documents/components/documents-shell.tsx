import { Input } from "@omnipaper/ui/components/input";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { UploadButton } from "@/features/documents/components/upload-button";
import { FilterBar } from "@/features/documents/filters/filter-bar";
import type { DocumentSearch } from "@/features/documents/filters/types";
import { SelectionBar } from "@/features/documents/selection/selection-bar";
import { DEMO_MODE } from "@/lib/demo-mode";

export function DocumentsShell({ orgId, children }: { orgId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DocumentSearch;
  const [text, setText] = useState(search.q ?? "");

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
        {!DEMO_MODE && <UploadButton orgId={orgId} />}
      </div>
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          placeholder="Search documents…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <FilterBar orgId={orgId} />
        <SelectionBar orgId={orgId} />
        {children}
      </div>
    </div>
  );
}
