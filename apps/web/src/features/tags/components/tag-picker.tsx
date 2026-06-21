import { Button } from "@omnipaper/ui/components/button";
import { Input } from "@omnipaper/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@omnipaper/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { type DocumentTag, useSetDocumentTags } from "@/features/documents/queries/documents";
import { TagChip } from "@/features/tags/components/tag-chip";
import { orgTagsQuery, useCreateTag } from "@/features/tags/queries/tags";

type TagPickerProps = {
  orgId: string;
  documentId: string;
  // The document's currently attached tags (server truth, from the detail query).
  tags: DocumentTag[];
};

export function TagPicker({ orgId, documentId, tags = [] }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: orgTagsData } = useQuery(orgTagsQuery({ orgId }));
  const orgTags = orgTagsData?.tags ?? [];

  const selectedIds = new Set(tags.map((t) => t.id));

  // Whole tag set is replaced on every change (the API is a replace-set PUT), so each toggle/remove
  // sends the full next set. The mutation updates optimistically, so the chips reflect the change
  // instantly and we don't disable them while the write is in flight.
  const setTags = useSetDocumentTags(orgId, documentId);
  const createTag = useCreateTag(orgId);

  // Only the create path is guarded — it's not optimistic, and a double-fire would POST twice.
  const creating = createTag.isPending;

  // Quick-create then attach the new tag to this document, and clear the search box.
  function createAndAttach(name: string) {
    createTag.mutate(name, {
      onSuccess: ({ tag }) => {
        setTags.mutate([...tags, { id: tag.id, name: tag.name, color: tag.color }]);
        setSearch("");
      },
    });
  }

  function toggle(tag: DocumentTag) {
    const next = selectedIds.has(tag.id)
      ? tags.filter((t) => t.id !== tag.id)
      : [...tags, { id: tag.id, name: tag.name, color: tag.color }];
    setTags.mutate(next);
  }

  function remove(tagId: string) {
    setTags.mutate(tags.filter((t) => t.id !== tagId));
  }

  const query = search.trim().toLowerCase();
  const filtered = orgTags.filter((t) => t.name.toLowerCase().includes(query));
  // Case-insensitive: don't offer "create" when a tag with this name already exists.
  const canCreate = query.length > 0 && !orgTags.some((t) => t.name.toLowerCase() === query);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag.id} name={tag.name} color={tag.color} onRemove={() => remove(tag.id)} />
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
                // Guard only against a double create-submit; tag toggles are optimistic and safe.
                if (e.key === "Enter" && canCreate && !creating) {
                  e.preventDefault();
                  createAndAttach(search.trim());
                }
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
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
                onClick={() => createAndAttach(search.trim())}
                disabled={creating}
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
