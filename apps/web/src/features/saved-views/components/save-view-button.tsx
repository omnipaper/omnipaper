import { Button } from "@omnipaper/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BookmarkPlusIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { DocumentSearch } from "@/features/documents/filters/types";
import {
  orgSavedViewsQuery,
  useCreateSavedView,
  useUpdateSavedView,
} from "@/features/saved-views/queries/saved-views";
import {
  extractViewState,
  hasSavableState,
  isSameViewState,
} from "@/features/saved-views/view-state";
import { SaveViewDialog } from "./save-view-dialog";

// The view-level save control in the filter bar. Two modes:
//   • no active saved view + something filtered → "Save view" (create).
//   • active saved view that the user has since edited → dirty triad: Save / Save as new / Reset.
// A clean active view (live state == snapshot) shows nothing — there's nothing to do.
export function SaveViewButton({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DocumentSearch;
  const { data } = useQuery(orgSavedViewsQuery({ orgId }));
  const create = useCreateSavedView(orgId);
  const update = useUpdateSavedView(orgId);
  const [dialog, setDialog] = useState<"create" | "fork" | null>(null);

  const currentState = extractViewState(search);
  const activeView = data?.savedViews.find((v) => v.id === search.savedView);
  const dirty = activeView ? !isSameViewState(currentState, activeView.state) : false;

  function applyActiveView(id: string) {
    navigate({
      to: ".",
      replace: true,
      search: (prev) => ({ ...(prev as DocumentSearch), savedView: id }),
    });
  }

  function handleCreate(name: string) {
    create.mutate(
      { name, state: currentState },
      {
        onSuccess: (res) => {
          setDialog(null);
          applyActiveView(res.savedView.id);
        },
      },
    );
  }

  function handleOverwrite() {
    if (!activeView) {
      return;
    }
    update.mutate(
      { id: activeView.id, state: currentState },
      { onSuccess: () => toast.success("View updated") },
    );
  }

  function handleReset() {
    if (!activeView) {
      return;
    }
    navigate({
      to: ".",
      replace: true,
      search: () => ({ ...activeView.state, savedView: activeView.id }),
    });
  }

  const dialogNode = (
    <SaveViewDialog
      open={dialog !== null}
      onOpenChange={(open) => setDialog(open ? dialog : null)}
      title={dialog === "fork" ? "Save as new view" : "Save view"}
      submitLabel="Save"
      pending={create.isPending}
      onSubmit={handleCreate}
    />
  );

  if (activeView && dirty) {
    return (
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          className="rounded-r-none"
          onClick={handleOverwrite}
          disabled={update.isPending}
        >
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-l-none border-l-0 px-2"
              aria-label="More save options"
            >
              <ChevronDownIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("fork")}>Save as new view</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleReset}>Reset changes</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogNode}
      </div>
    );
  }

  if (!activeView && hasSavableState(currentState)) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setDialog("create")}>
          <BookmarkPlusIcon className="size-4" />
          Save view
        </Button>
        {dialogNode}
      </>
    );
  }

  return null;
}
