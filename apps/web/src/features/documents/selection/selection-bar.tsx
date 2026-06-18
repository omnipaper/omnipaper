import { Button } from "@omnipaper/ui/components/button";
import { useSearch } from "@tanstack/react-router";
import { DownloadIcon, Loader2Icon, XIcon } from "lucide-react";
import type { DocumentSearch } from "@/features/documents/filters/types";
import { useDocumentSelection } from "./use-document-selection";
import { useExportDocuments } from "./use-export-documents";


export function SelectionBar({ orgId }: { orgId: string }) {
  const { hasSelection, allSelected, count, selectedIds, selectAllMatching, clear } =
    useDocumentSelection();
  const search = useSearch({ strict: false }) as DocumentSearch;
  const exportDocs = useExportDocuments(orgId);

  if (!hasSelection) {
    return null;
  }

  function download() {
    exportDocs.mutate(
      allSelected
        ? { all: true, q: search.q || undefined, filters: search.filters, sort: search.sort }
        : { documents: [...selectedIds] },
    );
  }

  return (
    <div className="-translate-x-1/2 fade-in slide-in-from-bottom-4 fixed bottom-6 left-1/2 z-50 flex animate-in items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
      <span className="font-medium text-sm">
        {allSelected ? "All matching documents selected" : `${count} selected`}
      </span>
      {!allSelected ? (
        <button
          type="button"
          onClick={selectAllMatching}
          className="text-muted-foreground text-xs hover:text-foreground"
        >
          Select all matching
        </button>
      ) : null}
      <div className="mx-1 h-4 w-px bg-border" />
      <Button size="sm" variant="outline" onClick={download} disabled={exportDocs.isPending}>
        {exportDocs.isPending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        Download
      </Button>
      <Button size="sm" variant="ghost" onClick={clear}>
        <XIcon />
        Clear
      </Button>
    </div>
  );
}
