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
import {
  orgDocumentTypesQuery,
  useDeleteDocumentType,
  useUpsertDocumentType,
} from "@/features/document-types/queries/document-types";

type DocumentTypeRow = { id: string; name: string; description: string | null };

const COLUMN_COUNT = 3;

export function DocumentTypesManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgDocumentTypesQuery({ orgId }));
  const deleteDocumentType = useDeleteDocumentType(orgId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(type: DocumentTypeRow) {
    setEditing(type);
    setDialogOpen(true);
  }

  const types = data?.documentTypes ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query ? types.filter((type) => type.name.toLowerCase().includes(query)) : types;

  let body: ReactNode;
  if (isPending) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>Loading…</TableEmptyRow>;
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT} className="text-destructive">
        Failed to load document types.
      </TableEmptyRow>
    );
  } else if (types.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>
        No document types yet. Create your first one.
      </TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>No document types match “{search}”.</TableEmptyRow>
    );
  } else {
    body = filtered.map((type) => (
      <TableRow key={type.id}>
        <TableCell className="font-medium">{type.name}</TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{type.description || "—"}</span>
        </TableCell>
        <TableCell className="text-right">
          <RowActions
            onEdit={() => openEdit(type)}
            onDelete={() => deleteDocumentType.mutate(type.id)}
            disabled={deleteDocumentType.isPending}
            deleteTitle={`Delete “${type.name}”?`}
            deleteDescription={
              type.documentCount > 0
                ? `Un-types ${type.documentCount} document${type.documentCount === 1 ? "" : "s"}. This can't be undone.`
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
        searchPlaceholder="Filter document types…"
      >
        <Button onClick={openCreate}>
          <PlusIcon />
          New document type
        </Button>
      </SettingsTableToolbar>

      <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
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
            <DocumentTypeDialogBody
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

function DocumentTypeDialogBody({
  orgId,
  editing,
  onDone,
}: {
  orgId: string;
  editing: DocumentTypeRow | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const upsert = useUpsertDocumentType(orgId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit document type" : "New document type"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Renaming updates this type on every document."
            : "An org-wide category documents can be classified as."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) {
            upsert.mutate(
              { id: editing?.id, name: name.trim(), description: description.trim() || null },
              { onSuccess: onDone },
            );
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-name">Name</Label>
          <Input
            id="type-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Invoice"
            autoFocus
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-description">Description (optional)</Label>
          <Input
            id="type-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="When does this type apply?"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={upsert.isPending || !name.trim()}>
            {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Add document type"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
