import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@omnipaper/ui/components/alert-dialog";
import { Button } from "@omnipaper/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { ChevronsRightIcon, DownloadIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { useDocumentSearch } from "@/features/documents/filters/use-document-search";
import {
  clearNavigationSet,
  saveNavigationSet,
} from "@/features/documents/navigation/navigation-set";
import { useDeleteDocuments } from "./use-delete-documents";
import { useDocumentSelection } from "./use-document-selection";
import { useExportDocuments } from "./use-export-documents";

export function SelectionBar({ orgId }: { orgId: string }) {
  const { hasSelection, allSelected, count, selectedIds, orderedIds, selectAllMatching, clear } =
    useDocumentSelection();
  const search = useDocumentSearch();
  const navigate = useNavigate();
  const exportDocs = useExportDocuments(orgId);
  const deleteDocs = useDeleteDocuments(orgId);

  if (!hasSelection) {
    return null;
  }

  function open() {
    const ids = allSelected ? orderedIds : orderedIds.filter((id) => selectedIds.has(id));
    const first = ids[0];
    if (!first) {
      return;
    }
    if (allSelected) {
      clearNavigationSet(orgId);
    } else {
      saveNavigationSet(orgId, ids);
    }
    navigate({ to: "/dashboard/orgs/$orgId/documents/$id", params: { orgId, id: first } });
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
      <Button size="sm" variant="outline" onClick={open}>
        <ChevronsRightIcon />
        Open
      </Button>
      <Button size="sm" variant="outline" onClick={download} disabled={exportDocs.isPending}>
        {exportDocs.isPending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        Download
      </Button>
      {/* Hidden while "all matching" is active: that selection has no client-side count, and this
          deletion is permanent, so there would be nothing meaningful to confirm against. */}
      {!allSelected ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={deleteDocs.isPending}>
              {deleteDocs.isPending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {count === 1 ? "Delete this document?" : `Delete ${count} documents?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes {count === 1 ? "it" : "them"} and the extracted text. This
                can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDocs.mutate([...selectedIds], { onSuccess: clear })}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <Button size="sm" variant="ghost" onClick={clear}>
        <XIcon />
        Clear
      </Button>
    </div>
  );
}
