import { Button } from "@omnipaper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@omnipaper/ui/components/dialog";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  RowActions,
  SettingsTableToolbar,
  TableEmptyRow,
} from "@/components/settings/settings-table";
import { STORAGE_PATH_PATTERN as PATH_PATTERN } from "@/features/storage-paths/path-format";
import {
  type OrgStoragePath,
  orgStoragePathsQuery,
  useDeleteStoragePath,
  useUpsertStoragePath,
} from "@/features/storage-paths/queries/storage-paths";

const COLUMN_COUNT = 3;

export function StoragePathsManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgStoragePathsQuery({ orgId }));
  const deleteStoragePath = useDeleteStoragePath(orgId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgStoragePath | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(storagePath: OrgStoragePath) {
    setEditing(storagePath);
    setDialogOpen(true);
  }

  const paths = data?.storagePaths ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? paths.filter((storagePath) => storagePath.path.toLowerCase().includes(query))
    : paths;

  let body: ReactNode;
  if (isPending) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>Loading…</TableEmptyRow>;
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT} className="text-destructive">
        Failed to load storage paths.
      </TableEmptyRow>
    );
  } else if (paths.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>
        No storage paths yet. Create your first one.
      </TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>No storage paths match “{search}”.</TableEmptyRow>;
  } else {
    body = filtered.map((storagePath) => (
      <TableRow key={storagePath.id}>
        <TableCell className="font-medium font-mono">{storagePath.path}</TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{storagePath.description || "—"}</span>
        </TableCell>
        <TableCell className="text-right">
          <RowActions
            onEdit={() => openEdit(storagePath)}
            onDelete={() => deleteStoragePath.mutate(storagePath.id)}
            disabled={deleteStoragePath.isPending}
            deleteTitle={`Delete “${storagePath.path}”?`}
            deleteDescription={
              storagePath.documentCount > 0
                ? `Un-files ${storagePath.documentCount} document${storagePath.documentCount === 1 ? "" : "s"}. This can't be undone.`
                : "This can't be undone."
            }
          />
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter storage paths…"
      >
        <Button onClick={openCreate}>
          <PlusIcon />
          New storage path
        </Button>
      </SettingsTableToolbar>

      <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Path</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {dialogOpen ? (
            <StoragePathDialogBody
              orgId={orgId}
              editing={editing}
              onDone={() => setDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoragePathDialogBody({
  orgId,
  editing,
  onDone,
}: {
  orgId: string;
  editing: OrgStoragePath | null;
  onDone: () => void;
}) {
  const [path, setPath] = useState(editing?.path ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const trimmedPath = path.trim();
  const pathValid = PATH_PATTERN.test(trimmedPath);
  const showPathError = trimmedPath.length > 0 && !pathValid;

  const upsert = useUpsertStoragePath(orgId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit storage path" : "New storage path"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Renaming updates this path on every document filed there."
            : "An org-wide filing path documents can be sorted into."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pathValid) {
            upsert.mutate(
              { id: editing?.id, path: trimmedPath, description: description.trim() || null },
              { onSuccess: onDone },
            );
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="path-value">Path</Label>
          <Input
            id="path-value"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            maxLength={255}
            placeholder="/Finance/2024/Invoices"
            className="font-mono"
            aria-invalid={showPathError}
            autoFocus
            required
          />
          <p
            className={showPathError ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
          >
            Leading slash, segments separated by “/”, no spaces.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="path-description">Description (optional)</Label>
          <Input
            id="path-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="What gets filed here?"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={upsert.isPending || !pathValid}>
            {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Add storage path"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
