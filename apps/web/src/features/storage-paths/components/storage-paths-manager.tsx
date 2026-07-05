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
import { Switch } from "@omnipaper/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { CircleHelpIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { RowActions, TableEmptyRow } from "@/components/settings/settings-table";
import { AiAssignMaster } from "@/features/ai-assign/components/ai-assign-master";
import { aiAssignQuery } from "@/features/ai-assign/queries/ai-assign";
import { STORAGE_PATH_PATTERN as PATH_PATTERN } from "@/features/storage-paths/path-format";
import {
  type OrgStoragePath,
  orgStoragePathsQuery,
  useDeleteStoragePath,
  useSetStoragePathAiEligible,
  useUpsertStoragePath,
} from "@/features/storage-paths/queries/storage-paths";

export function StoragePathsManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgStoragePathsQuery({ orgId }));
  const aiQuery = useQuery(aiAssignQuery({ orgId }));
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

  const setAiEligible = useSetStoragePathAiEligible(orgId);
  const aiEnabled = aiQuery.data?.fields.storagePath.enabled ?? false;
  const columnCount = aiEnabled ? 4 : 3;

  let body: ReactNode;
  if (isPending) {
    body = (
      <TableEmptyRow colSpan={columnCount}>
        <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground/50" />
      </TableEmptyRow>
    );
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={columnCount} className="text-destructive">
        Failed to load storage paths.
      </TableEmptyRow>
    );
  } else if (paths.length === 0) {
    body = (
      <TableEmptyRow colSpan={columnCount}>
        No storage paths yet. Create your first one.
      </TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = <TableEmptyRow colSpan={columnCount}>No storage paths match “{search}”.</TableEmptyRow>;
  } else {
    body = filtered.map((storagePath) => (
      <TableRow key={storagePath.id}>
        <TableCell className="font-medium font-mono">{storagePath.path}</TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{storagePath.description || "—"}</span>
        </TableCell>
        {aiEnabled ? (
          <TableCell className="text-center">
            <Switch
              checked={storagePath.aiEligible}
              onCheckedChange={(next) =>
                setAiEligible.mutate({ id: storagePath.id, aiEligible: next })
              }
              aria-label={`Allow AI to use ${storagePath.path}`}
            />
          </TableCell>
        ) : null}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter storage paths…"
            aria-label="Filter storage paths"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AiAssignMaster
            orgId={orgId}
            field="storagePath"
            label="storage paths"
            variant="button"
          />
          <Button onClick={openCreate}>
            <PlusIcon />
            New storage path
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-card border border-border/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Path</TableHead>
              <TableHead>Description</TableHead>
              {aiEnabled ? (
                <TableHead className="w-28 text-center">
                  <span className="inline-flex items-center justify-center gap-1">
                    Used by AI
                    <span
                      className="cursor-help text-muted-foreground"
                      title="When off, AI won't assign this storage path."
                    >
                      <CircleHelpIcon className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                </TableHead>
              ) : null}
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
