import { TagChip } from "@/components/tag-chip";
import { api } from "@/lib/api";
import { documentKeys } from "@/lib/queries/documents";
import { orgTagsQuery, tagKeys } from "@/lib/queries/tags";
import { Button } from "@omnipaper/ui/components/button";
import { Input } from "@omnipaper/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Tag = { id: string; name: string; color: string };

type TagPickerProps = {
  orgId: string;
  documentId: string;
  // The document's currently attached tags (server truth, from the detail query).
  tags: Tag[];
};

export function TagPicker({ orgId, documentId, tags = [] }: TagPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: orgTagsData } = useQuery(orgTagsQuery({ orgId }));
  const orgTags = orgTagsData?.tags ?? [];

  const selectedIds = new Set(tags.map((t) => t.id));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: documentKeys.detail({ orgId, id: documentId }) });
    queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
  }

  // Whole tag set is replaced on every change (the API is a replace-set PUT), so each toggle/remove
  // sends the full next set. Server truth is re-read via invalidate rather than tracked locally.
  const setTagsMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      const res = await api.orgs[":orgId"].documents[":id"].tags.$put({
        param: { orgId, id: documentId },
        json: { tagIds },
      });
      if (!res.ok) {
        throw new Error("Failed to update tags");
      }
      return res.json();
    },
    onSuccess: invalidate,
    onError: () => toast.error("Failed to update tags"),
  });

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.orgs[":orgId"].tags.$post({ param: { orgId }, json: { name } });
      if (!res.ok) {
        throw new Error("Failed to create tag");
      }
      return res.json();
    },
    onSuccess: ({ tag }) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists(orgId) });
      setTagsMutation.mutate([...selectedIds, tag.id]);
      setSearch("");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const pending = setTagsMutation.isPending || createTagMutation.isPending;

  function toggle(tagId: string) {
    const next = new Set(selectedIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setTagsMutation.mutate([...next]);
  }

  function remove(tagId: string) {
    setTagsMutation.mutate(tags.filter((t) => t.id !== tagId).map((t) => t.id));
  }

  const query = search.trim().toLowerCase();
  const filtered = orgTags.filter((t) => t.name.toLowerCase().includes(query));
  // Case-insensitive: don't offer "create" when a tag with this name already exists.
  const canCreate = query.length > 0 && !orgTags.some((t) => t.name.toLowerCase() === query);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          name={tag.name}
          color={tag.color}
          disabled={pending}
          onRemove={() => remove(tag.id)}
        />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <div className="p-1">
            <Input
              autoFocus
              placeholder="Search or create…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Mirror the buttons' pending guard so Enter can't fire a write while a replace-set
                // PUT is in flight — otherwise a concurrent toggle could be lost (last-write-wins).
                if (e.key === "Enter" && canCreate && !pending) {
                  e.preventDefault();
                  createTagMutation.mutate(search.trim());
                }
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate">{tag.name}</span>
                {selectedIds.has(tag.id) ? (
                  <Check className="size-3.5 text-muted-foreground" />
                ) : null}
              </button>
            ))}

            {canCreate ? (
              <button
                type="button"
                onClick={() => createTagMutation.mutate(search.trim())}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Create “{search.trim()}”
              </button>
            ) : null}

            {filtered.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching tags.</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
