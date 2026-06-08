import {
  RowActions,
  SettingsTableToolbar,
  TableEmptyRow,
} from "@/components/settings/settings-table";
import {
  customPropertyKeys,
  orgPropertyDefinitionsQuery,
} from "@/features/custom-properties/queries/custom-properties";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

const DEFAULT_COLOR = "#94a3b8";

type PropertyType = "text" | "url" | "number" | "date" | "boolean" | "select";

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
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(orgPropertyDefinitionsQuery({ orgId }));

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].$delete({
        param: { orgId, id },
      });
      if (!res.ok) {
        throw new Error("Failed to delete property");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
      toast.success("Property deleted");
    },
    onError: (error) => toast.error(error.message),
  });

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
            onDelete={() => deleteMutation.mutate(definition.id)}
            disabled={deleteMutation.isPending}
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
  const queryClient = useQueryClient();
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

  function invalidateProperties() {
    queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const res = editing
        ? await api.orgs[":orgId"]["custom-properties"][":id"].$patch({
            param: { orgId, id: editing.id },
            json: { name: trimmedName, description: trimmedDescription || null },
          })
        : await api.orgs[":orgId"]["custom-properties"].$post({
            param: { orgId },
            json: { name: trimmedName, type, description: trimmedDescription || undefined },
          });
      if (!res.ok) {
        throw new Error(
          res.status === 400
            ? "A property with this name already exists"
            : editing
              ? "Failed to update property"
              : "Failed to create property",
        );
      }
    },
    onSuccess: () => {
      // A rename only touches the catalog query; documents read property names from it, so no need
      // to refetch every document here (delete handles that separately).
      invalidateProperties();
      toast.success(editing ? "Property updated" : "Property created");
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  const addOptionMutation = useMutation({
    mutationFn: async (vars: { label: string; color: string }) => {
      if (!editing) return;
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options.$post({
        param: { orgId, id: editing.id },
        json: { label: vars.label, color: vars.color },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "An option with this label already exists" : "Failed to add option",
        );
      }
    },
    onSuccess: invalidateProperties,
    onError: (error) => toast.error(error.message),
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      if (!editing) return;
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options[":optionId"].$delete(
        {
          param: { orgId, id: editing.id, optionId },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to remove option");
      }
    },
    onSuccess: () => {
      invalidateProperties();
      queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
    },
    onError: (error) => toast.error(error.message),
  });

  const optionsPending = addOptionMutation.isPending || deleteOptionMutation.isPending;
  const options = editing?.options ?? [];

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
            saveMutation.mutate();
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
          {!editing && type === "select" ? (
            <p className="text-muted-foreground text-xs">
              Add options after creating the property.
            </p>
          ) : null}
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

        {editing && editing.type === "select" ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <Label>Options</Label>
            <div className="flex flex-wrap gap-1.5">
              {options.length === 0 ? (
                <span className="text-muted-foreground text-xs">No options yet.</span>
              ) : (
                options.map((option) => (
                  <span
                    key={option.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-foreground text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color ?? DEFAULT_COLOR }}
                    />
                    {option.label}
                    <button
                      type="button"
                      disabled={optionsPending}
                      aria-label={`Remove ${option.label}`}
                      onClick={() => setOptionToRemove({ id: option.id, label: option.label })}
                      className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <AddOptionForm
              disabled={optionsPending}
              onAdd={(label, color) => addOptionMutation.mutate({ label, color })}
            />
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {editing ? "Done" : "Cancel"}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={saveMutation.isPending || !name.trim()}>
            {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add property"}
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
                  deleteOptionMutation.mutate(optionToRemove.id);
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
