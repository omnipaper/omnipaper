import { api } from "@/lib/api";
import { documentKeys } from "@/lib/queries/documents";
import { orgTagsQuery, tagKeys } from "@/lib/queries/tags";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

const DEFAULT_COLOR = "#94a3b8";

type EditableTag = { id: string; name: string; color: string; description: string | null };

export function TagsManager({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(orgTagsQuery({ orgId }));

  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [editDescription, setEditDescription] = useState("");

  function invalidateTags() {
    queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
  }

  // Rename/recolor/delete change how a tag renders on documents, so refresh those views too.
  function invalidateDocuments() {
    queryClient.invalidateQueries({ queryKey: documentKeys.all(orgId) });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.orgs[":orgId"].tags.$post({
        param: { orgId },
        json: { name: name.trim(), color, description: description.trim() || undefined },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A tag with this name already exists" : "Failed to create tag",
        );
      }
    },
    onSuccess: () => {
      setName("");
      setColor(DEFAULT_COLOR);
      setDescription("");
      invalidateTags();
      toast.success("Tag created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].tags[":id"].$patch({
        param: { orgId, id },
        json: {
          name: editName.trim(),
          color: editColor,
          description: editDescription.trim() || null,
        },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 400 ? "A tag with this name already exists" : "Failed to update tag",
        );
      }
    },
    onSuccess: () => {
      setEditingId(null);
      invalidateTags();
      invalidateDocuments();
      toast.success("Tag updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.orgs[":orgId"].tags[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Failed to delete tag");
      }
    },
    onSuccess: () => {
      invalidateTags();
      invalidateDocuments();
      toast.success("Tag deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  function startEdit(tag: EditableTag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditDescription(tag.description ?? "");
  }

  function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim()) {
      createMutation.mutate();
    }
  }

  const tags = data?.tags ?? [];

  let listContent: ReactNode;

  if (isPending) {
    listContent = <p className="text-muted-foreground text-sm">Loading…</p>;
  } else if (isError) {
    listContent = <p className="text-destructive text-sm">Failed to load tags.</p>;
  } else if (tags.length === 0) {
    listContent = <p className="text-muted-foreground text-sm">No tags yet. Create one below.</p>;
  } else {
    listContent = tags.map((tag) => {
      if (editingId === tag.id) {
        return (
          <div
            key={tag.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="flex flex-1 items-center gap-2">
              <input
                type="color"
                aria-label="Tag color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="size-7 shrink-0 cursor-pointer rounded border bg-transparent"
              />
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
                className="w-40"
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
                onClick={() => updateMutation.mutate(tag.id)}
                disabled={updateMutation.isPending || !editName.trim()}
              >
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div
          key={tag.id}
          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{tag.name}</span>
              {tag.description ? (
                <span className="truncate text-muted-foreground text-sm">{tag.description}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {tag.documentCount} {tag.documentCount === 1 ? "doc" : "docs"}
            </span>
            <Button variant="outline" size="sm" onClick={() => startEdit(tag)}>
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
                  <AlertDialogTitle>Delete “{tag.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tag.documentCount > 0
                      ? `Removes it from ${tag.documentCount} document${tag.documentCount === 1 ? "" : "s"}. This can't be undone.`
                      : "This can't be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(tag.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Org-wide labels. Renaming or recoloring a tag updates it on every document.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">{listContent}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New tag</CardTitle>
          <CardDescription>Members can also create tags inline from a document.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="flex flex-col gap-4">
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
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="self-start"
            >
              {createMutation.isPending ? "Creating…" : "Add tag"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
