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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
  RowActions,
  SettingsTableToolbar,
  TableEmptyRow,
} from "@/components/settings/settings-table";
import {
  type PropertyDefinition,
  orgPropertyDefinitionsQuery,
  useAddPropertyOption,
  useDeletePropertyDefinition,
  useDeletePropertyOption,
  useUpsertPropertyDefinition,
} from "@/features/custom-properties/queries/custom-properties";

const DEFAULT_COLOR = "#94a3b8";

type PropertyType = PropertyDefinition["type"];

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Select" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((t) => [t.value, t.label]),
);

const COLUMN_COUNT = 5;

export function CustomPropertiesManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const deleteDefinition = useDeletePropertyDefinition(orgId);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  const definitions = data?.definitions ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? definitions.filter((definition) => definition.name.toLowerCase().includes(query))
    : definitions;

  let body: ReactNode;
  if (isPending) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>Loading…</TableEmptyRow>;
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT} className="text-destructive">
        Failed to load properties.
      </TableEmptyRow>
    );
  } else if (definitions.length === 0) {
    body = (
      <TableEmptyRow colSpan={COLUMN_COUNT}>
        No properties yet. Create your first one.
      </TableEmptyRow>
    );
  } else if (filtered.length === 0) {
    body = <TableEmptyRow colSpan={COLUMN_COUNT}>No properties match “{search}”.</TableEmptyRow>;
  } else {
    body = filtered.map((definition) => (
      <TableRow key={definition.id}>
        <TableCell className="font-medium">{definition.name}</TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
              {TYPE_LABEL[definition.type] ?? definition.type}
            </span>
            {definition.type === "select" ? (
              <span className="text-muted-foreground text-xs">
                {definition.options.length} {definition.options.length === 1 ? "option" : "options"}
              </span>
            ) : null}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">{definition.description || "—"}</span>
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">
          {definition.documentCount}
        </TableCell>
        <TableCell className="text-right">
          <RowActions
            onEdit={() => openEdit(definition.id)}
            onDelete={() => deleteDefinition.mutate(definition.id)}
            disabled={deleteDefinition.isPending}
            deleteTitle={`Delete “${definition.name}”?`}
            deleteDescription={
              definition.documentCount > 0
                ? `Removes this property and its value from ${definition.documentCount} document${definition.documentCount === 1 ? "" : "s"}. This can't be undone.`
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
        searchPlaceholder="Filter properties…"
      >
        <Button onClick={openCreate}>
          <PlusIcon />
          New property
        </Button>
      </SettingsTableToolbar>

      <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
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
            <PropertyDialogBody
              orgId={orgId}
              editingId={editingId}
              onDone={() => setDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PropertyDialogBody({
  orgId,
  editingId,
  onDone,
}: {
  orgId: string;
  editingId: string | null;
  onDone: () => void;
}) {
  // Read the live definition (not a snapshot) so its select options stay in sync as they're
  // added/removed without closing the dialog.
  const { data } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const editing = editingId
    ? ((data?.definitions ?? []).find((d) => d.id === editingId) ?? null)
    : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<PropertyType>((editing?.type as PropertyType) ?? "text");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [optionToRemove, setOptionToRemove] = useState<{ id: string; label: string } | null>(null);
  // Create mode collects select options here and saves them together with the property in one
  // atomic POST. Edit mode uses the live `editing.options` + their own add/remove endpoints.
  const [draftOptions, setDraftOptions] = useState<{ label: string; color: string }[]>([]);

  const upsert = useUpsertPropertyDefinition(orgId);
  // Option hooks only fire in edit mode (create collects draftOptions locally), so binding them to
  // the editing id — empty otherwise — is safe.
  const addOption = useAddPropertyOption(orgId, editing?.id ?? "");
  const deleteOption = useDeletePropertyOption(orgId, editing?.id ?? "");

  const optionsPending = addOption.isPending || deleteOption.isPending;
  const isSelect = type === "select";

  // One options list for both modes: live (edit) or local draft (create).
  const displayOptions = editing
    ? (editing.options ?? []).map((o) => ({
        key: o.id,
        label: o.label,
        color: o.color ?? DEFAULT_COLOR,
        onRemove: () => setOptionToRemove({ id: o.id, label: o.label }),
      }))
    : draftOptions.map((o, index) => ({
        key: `${o.label}-${index}`,
        label: o.label,
        color: o.color,
        onRemove: () => setDraftOptions((prev) => prev.filter((_, i) => i !== index)),
      }));

  function handleAddOption(label: string, color: string) {
    if (editing) {
      addOption.mutate({ label, color });
      return;
    }
    if (draftOptions.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      toast.error("An option with this label already exists");
      return;
    }
    setDraftOptions((prev) => [...prev, { label, color }]);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit property" : "New property"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Type can't change after a property is created."
            : "A typed field documents can carry. Pick a type now — it's fixed once created."}
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
                type,
                description: description.trim() || null,
                options: draftOptions,
              },
              { onSuccess: onDone },
            );
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="property-name">Name</Label>
          <Input
            id="property-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Invoice amount"
            autoFocus
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="property-type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as PropertyType)}
            disabled={!!editing}
          >
            <SelectTrigger id="property-type" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="property-description">Description (optional)</Label>
          <Input
            id="property-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>

        {isSelect ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label>Options</Label>
            <div className="flex flex-wrap gap-1.5">
              {displayOptions.length === 0 ? (
                <span className="text-muted-foreground text-xs">No options yet.</span>
              ) : (
                displayOptions.map((option) => (
                  <span
                    key={option.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-foreground text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                    <button
                      type="button"
                      disabled={optionsPending}
                      aria-label={`Remove ${option.label}`}
                      onClick={option.onRemove}
                      className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <AddOptionForm disabled={optionsPending} onAdd={handleAddOption} />
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editing ? "Done" : "Cancel"}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={upsert.isPending || !name.trim()}>
            {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Add property"}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog
        open={!!optionToRemove}
        onOpenChange={(open) => {
          if (!open) setOptionToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{optionToRemove?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This option will be removed from any documents using it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (optionToRemove) {
                  deleteOption.mutate(optionToRemove.id);
                }
                setOptionToRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddOptionForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (label: string, color: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Option color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded border bg-transparent"
      />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={100}
        placeholder="New option"
        className="flex-1"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !label.trim()}
        onClick={() => {
          onAdd(label.trim(), color);
          setLabel("");
          setColor(DEFAULT_COLOR);
        }}
      >
        Add
      </Button>
    </div>
  );
}
