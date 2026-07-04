import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@omnipaper/ui/components/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@omnipaper/ui/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@omnipaper/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { BookmarkIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import type { DocumentSearch } from "@/features/documents/filters/types";
import {
  type OrgSavedView,
  orgSavedViewsQuery,
  useCreateSavedView,
  useDeleteSavedView,
  useUpdateSavedView,
} from "@/features/saved-views/queries/saved-views";
import { SaveViewDialog } from "./save-view-dialog";

export function SavedViewsSidebar({ orgId }: { orgId: string }) {
  const { data } = useQuery(orgSavedViewsQuery({ orgId }));
  const views = data?.savedViews ?? [];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Saved views</SidebarGroupLabel>
      <SidebarGroupContent>
        {views.length === 0 ? (
          <p className="px-2 py-1 text-muted-foreground text-xs">
            Filter documents, then Save view.
          </p>
        ) : (
          <SidebarMenu>
            {views.map((view) => (
              <SavedViewRow key={view.id} orgId={orgId} view={view} />
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SavedViewRow({ orgId, view }: { orgId: string; view: OrgSavedView }) {
  const { pathname } = useLocation();
  const search = useSearch({ strict: false }) as DocumentSearch;
  const update = useUpdateSavedView(orgId);
  const create = useCreateSavedView(orgId);
  const remove = useDeleteSavedView(orgId);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isActive = pathname.endsWith("/documents") && search.savedView === view.id;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link
          to="/dashboard/orgs/$orgId/documents"
          params={{ orgId }}
          search={{ ...view.state, savedView: view.id }}
        >
          <BookmarkIcon />
          <span className="truncate" title={view.name}>
            {view.name}
          </span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`${view.name} options`}>
            <MoreHorizontalIcon />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => create.mutate({ name: `Copy of ${view.name}`, state: view.state })}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveViewDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename view"
        submitLabel="Rename"
        initialName={view.name}
        pending={update.isPending}
        onSubmit={(name) =>
          update.mutate({ id: view.id, name }, { onSuccess: () => setRenaming(false) })
        }
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{view.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved view for everyone in the organization. The documents themselves
              are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(view.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  );
}
