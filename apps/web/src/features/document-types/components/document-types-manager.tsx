import {
  RowActions,
  SettingsTableToolbar,
  TableEmptyRow,
} from "@/components/settings/settings-table";
import {
  documentTypeKeys,
  orgDocumentTypesQuery,
} from "@/features/document-types/queries/document-types";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

type DocumentTypeRow = { id: string; name: string; description: string | null };

const COLUMN_COUNT = 3;

export function DocumentTypesManager({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(orgDocumentTypesQuery({ orgId }));

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeRow | null>(null);

  // Renaming or deleting a type changes how it renders on documents, so refresh those views too.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["document-types"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete document type");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Document type deleted");
    },
    onError: (error) => toast.error(error.message),
  });

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
            onDelete={() => deleteMutation.mutate(type.id)}
            disabled={deleteMutation.isPending}
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
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const res = editing
        ? await api.orgs[":orgId"]["document-types"][":id"].$patch({
            param: { orgId, id: editing.id },
            json: { name: trimmedName, description: trimmedDescription || null },
          })
        : await api.orgs[":orgId"]["document-types"].$post({
            param: { orgId },
            json: { name: trimmedName, description: trimmedDescription || undefined },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A document type with this name already exists"
            : editing
              ? "Failed to update document type"
              : "Failed to create document type",
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentTypeKeys.lists(orgId) });
      if (editing) {
        queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      }
      toast.success(editing ? "Document type updated" : "Document type created");
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

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
            mutation.mutate();
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
          <Button type="submit" disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add document type"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
