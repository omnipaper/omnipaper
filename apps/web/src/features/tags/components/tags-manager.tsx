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
import { orgTagsQuery, useDeleteTag, useUpsertTag } from "@/features/tags/queries/tags";

// New-tag colour starts on a random hue (matching the server default) instead of a flat grey.
const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
] as const;

function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] ?? TAG_COLORS[0];
}

type TagRow = { id: string; name: string; color: string; description: string | null };

const COLUMN_COUNT = 4;

export function TagsManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgTagsQuery({ orgId }));
  const deleteTag = useDeleteTag(orgId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TagRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(tag: TagRow) {
    setEditing(tag);
    setDialogOpen(true);
  }

  const tags = data?.tags ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query ? tags.filter((tag) => tag.name.toLowerCase().includes(query)) : tags;

  let body: ReactNode;
  if (isPending) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>Loading…</TableEmptyRow>;
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT} className="text-destructive">
        Failed to load tags.
      </TableEmptyRow>
    );
  } else if (tags.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>No tags yet. Create your first one.</TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>No tags match “{search}”.</TableEmptyRow>;
  } else {
    body = filtered.map((tag) => (
      <TableRow key={tag.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
            <span className="font-medium">{tag.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{tag.description || "—"}</span>
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">
          {tag.documentCount}
        </TableCell>
        <TableCell className="text-right">
          <RowActions
            onEdit={() => openEdit(tag)}
            onDelete={() => deleteTag.mutate(tag.id)}
            disabled={deleteTag.isPending}
            deleteTitle={`Delete “${tag.name}”?`}
            deleteDescription={
              tag.documentCount > 0
                ? `Removes it from ${tag.documentCount} document${tag.documentCount === 1 ? "" : "s"}. This can't be undone.`
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
        searchPlaceholder="Filter tags…"
      >
        <Button onClick={openCreate}>
          <PlusIcon />
          New tag
        </Button>
      </SettingsTableToolbar>

      <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Documents</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {dialogOpen ? (
            <TagDialogBody orgId={orgId} editing={editing} onDone={() => setDialogOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mounted only while the dialog is open, so its form state is fresh on every open (create vs. the
// tag being edited) without a reset effect.
function TagDialogBody({
  orgId,
  editing,
  onDone,
}: {
  orgId: string;
  editing: TagRow | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? randomTagColor());
  const [description, setDescription] = useState(editing?.description ?? "");

  const upsert = useUpsertTag(orgId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Renaming or recoloring updates this tag on every document."
            : "An org-wide label members can apply to documents."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) {
            upsert.mutate(
              {
                id: editing?.id,
                name: name.trim(),
                color,
                description: description.trim() || null,
              },
              { onSuccess: onDone },
            );
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-name">Name</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Tag color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-8 shrink-0 cursor-pointer rounded border bg-transparent"
            />
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Invoice"
              autoFocus
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag-description">Description (optional)</Label>
          <Input
            id="tag-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={upsert.isPending || !name.trim()}>
            {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Add tag"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
