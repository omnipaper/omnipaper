import { api } from "@/lib/api";
import { customPropertyKeys, orgPropertyDefinitionsQuery } from "@/lib/queries/custom-properties";
import { documentKeys } from "@/lib/queries/documents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@omnipaper/ui/components/alert-dialog";
import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type SubmitEvent, type ReactNode, useState } from "react";
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

type EditableDefinition = { id: string; name: string; description: string | null };

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

export function CustomPropertiesManager({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(orgPropertyDefinitionsQuery({ orgId }));

  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  function invalidateProperties() {
    queryClient.invalidateQueries({ queryKey: customPropertyKeys.lists(orgId) });
  }

  // Renaming a property or removing an option changes how documents render, so refresh them too.
  function invalidateDocuments() {
    queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.orgs[":orgId"]["custom-properties"].$post({
        param: { orgId },
        json: { name: name.trim(), type, description: description.trim() || undefined },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A property with this name already exists" : "Failed to create",
        );
      }
    },
    onSuccess: () => {
      setName("");
      setType("text");
      setDescription("");
      invalidateProperties();
      toast.success("Property created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].$patch({
        param: { orgId, id },
        json: { name: editName.trim(), description: editDescription.trim() || null },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A property with this name already exists" : "Failed to update",
        );
      }
    },
    onSuccess: () => {
      setEditingId(null);
      // Document detail reads property names from the catalog query, not the document payload, so a
      // rename only needs the catalog invalidated — no need to refetch every document.
      invalidateProperties();
      toast.success("Property updated");
    },
    onError: (error) => toast.error(error.message),
  });

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
      invalidateProperties();
      invalidateDocuments();
      toast.success("Property deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const addOptionMutation = useMutation({
    mutationFn: async (vars: { definitionId: string; label: string; color: string }) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options.$post({
        param: { orgId, id: vars.definitionId },
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
    mutationFn: async (vars: { definitionId: string; optionId: string }) => {
      const res = await api.orgs[":orgId"]["custom-properties"][":id"].options[":optionId"].$delete(
        {
          param: { orgId, id: vars.definitionId, optionId: vars.optionId },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to remove option");
      }
    },
    onSuccess: () => {
      invalidateProperties();
      invalidateDocuments();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addOptionMutation.isPending ||
    deleteOptionMutation.isPending;

  function startEdit(definition: EditableDefinition) {
    setEditingId(definition.id);
    setEditName(definition.name);
    setEditDescription(definition.description ?? "");
  }

  function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim()) {
      createMutation.mutate();
    }
  }

  const definitions = data?.definitions ?? [];

  let listContent: ReactNode;

  if (isPending) {
    listContent = <p className="text-muted-foreground text-sm">Loading…</p>;
  } else if (isError) {
    listContent = <p className="text-destructive text-sm">Failed to load properties.</p>;
  } else if (definitions.length === 0) {
    listContent = (
      <p className="text-muted-foreground text-sm">No properties yet. Create one below.</p>
    );
  } else {
    listContent = definitions.map((definition) => (
      <div key={definition.id} className="flex flex-col gap-2 rounded-md border px-3 py-2">
        {editingId === definition.id ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={100}
                className="w-48"
              />
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={500}
                placeholder="Description (optional)"
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(definition.id)}
                disabled={pending || !editName.trim()}
              >
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{definition.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                  {TYPE_LABEL[definition.type] ?? definition.type}
                </span>
              </div>
              {definition.description ? (
                <span className="text-muted-foreground text-sm">{definition.description}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {definition.documentCount} {definition.documentCount === 1 ? "doc" : "docs"}
              </span>
              <Button variant="outline" size="sm" onClick={() => startEdit(definition)}>
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{definition.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {definition.documentCount > 0
                        ? `Removes this property and its value from ${definition.documentCount} document${definition.documentCount === 1 ? "" : "s"}. This can't be undone.`
                        : "This can't be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(definition.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {definition.type === "select" ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="flex flex-wrap gap-1.5">
              {definition.options.length === 0 ? (
                <span className="text-muted-foreground text-xs">No options yet.</span>
              ) : (
                definition.options.map((option) => (
                  <span
                    key={option.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-foreground text-xs"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color ?? DEFAULT_COLOR }}
                    />
                    {option.label}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Remove ${option.label}`}
                          className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                        >
                          <X className="size-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove “{option.label}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This option will be removed from any documents using it. This can't be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() =>
                              deleteOptionMutation.mutate({
                                definitionId: definition.id,
                                optionId: option.id,
                              })
                            }
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                ))
              )}
            </div>
            <AddOptionForm
              disabled={pending}
              onAdd={(label, color) =>
                addOptionMutation.mutate({ definitionId: definition.id, label, color })
              }
            />
          </div>
        ) : null}
      </div>
    ));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom properties</CardTitle>
          <CardDescription>
            Typed fields documents can carry. A property's type can't change after it's created.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">{listContent}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New property</CardTitle>
          <CardDescription>Pick a type now — it's fixed once the property exists.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="property-name">Name</Label>
              <Input
                id="property-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Invoice amount"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="property-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
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
              {type === "select" ? (
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
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="self-start"
            >
              {createMutation.isPending ? "Creating…" : "Add property"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
