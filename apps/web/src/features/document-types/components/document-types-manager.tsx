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
import {
  type OrgDocumentType,
  orgDocumentTypesQuery,
  useDeleteDocumentType,
  useSetDocumentTypeAiEligible,
  useUpsertDocumentType,
} from "@/features/document-types/queries/document-types";

export function DocumentTypesManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgDocumentTypesQuery({ orgId }));
  const aiQuery = useQuery(aiAssignQuery({ orgId }));
  const deleteDocumentType = useDeleteDocumentType(orgId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgDocumentType | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(type: OrgDocumentType) {
    setEditing(type);
    setDialogOpen(true);
  }

  const types = data?.documentTypes ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query ? types.filter((type) => type.name.toLowerCase().includes(query)) : types;

  const setAiEligible = useSetDocumentTypeAiEligible(orgId);
  const aiEnabled = aiQuery.data?.fields.documentType.enabled ?? false;
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
        Failed to load document types.
      </TableEmptyRow>
    );
  } else if (types.length === 0) {
    body = (
      <TableEmptyRow colSpan={columnCount}>
        No document types yet. Create your first one.
      </TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = <TableEmptyRow colSpan={columnCount}>No document types match “{search}”.</TableEmptyRow>;
  } else {
    body = filtered.map((type) => (
      <TableRow key={type.id}>
        <TableCell className="font-medium">{type.name}</TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{type.description || "—"}</span>
        </TableCell>
        {aiEnabled ? (
          <TableCell className="text-center">
            <Switch
              checked={type.aiEligible}
              onCheckedChange={(next) => setAiEligible.mutate({ id: type.id, aiEligible: next })}
              aria-label={`Allow AI to use ${type.name}`}
            />
          </TableCell>
        ) : null}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter document types…"
            aria-label="Filter document types"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AiAssignMaster
            orgId={orgId}
            field="documentType"
            label="document types"
            variant="button"
          />
          <Button onClick={openCreate}>
            <PlusIcon />
            New document type
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-card border border-border/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              {aiEnabled ? (
                <TableHead className="w-28 text-center">
                  <span className="inline-flex items-center justify-center gap-1">
                    Used by AI
                    <span
                      className="cursor-help text-muted-foreground"
                      title="When off, AI won't assign this document type."
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
  editing: OrgDocumentType | null;
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
