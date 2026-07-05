import { useQuery } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { type DocumentTag, useSetDocumentTags } from "@/features/documents/queries/documents";
import {
  type DocumentSuggestion,
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/suggestions";
import { type OrgTag, orgTagsQuery, useCreateTag } from "@/features/tags/queries/tags";

// AI tag suggestions are a set, so unlike single-value fields the user picks tags one at a time
// instead of accepting the whole batch. Each pick uses the normal add-tag path; the suggestion is
// retired once its last tag is taken (or dismissed wholesale).
export function TagSuggestions({
  orgId,
  documentId,
  suggestion,
  tags,
}: {
  orgId: string;
  documentId: string;
  suggestion: DocumentSuggestion;
  tags: DocumentTag[];
}) {
  const { data: orgTagsData } = useQuery(orgTagsQuery({ orgId }));
  const orgTags = orgTagsData?.tags ?? [];

  const setTags = useSetDocumentTags(orgId, documentId);
  const createTag = useCreateTag(orgId);
  const accept = useAcceptSuggestion(orgId, documentId);
  const dismiss = useDismissSuggestion(orgId, documentId);

  const value = suggestion.suggestedValue;
  if (!("existingIds" in value)) {
    return null;
  }

  const attachedIds = new Set(tags.map((t) => t.id));
  const attachedNames = new Set(tags.map((t) => t.name.toLowerCase()));

  // Only surface what isn't on the document yet, so taking a tag makes it disappear from the strip.
  const existing = value.existingIds
    .map((id) => orgTags.find((t) => t.id === id))
    .filter((t): t is OrgTag => t !== undefined && !attachedIds.has(t.id));
  const newNames = value.newNames.filter((n) => !attachedNames.has(n.toLowerCase()));

  const remaining = existing.length + newNames.length;
  if (remaining === 0) {
    return null;
  }

  // Taking the last outstanding tag retires the suggestion so it stops lingering as pending.
  const retireIfLast = () => {
    if (remaining === 1) {
      dismiss.mutate(suggestion.id);
    }
  };

  const addExisting = (tag: OrgTag) => {
    setTags.mutate([...tags, { id: tag.id, name: tag.name, color: tag.color }]);
    retireIfLast();
  };

  const addNew = (name: string) => {
    createTag.mutate(name, {
      onSuccess: ({ tag }) =>
        setTags.mutate([...tags, { id: tag.id, name: tag.name, color: tag.color }]),
    });
    retireIfLast();
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs">
      <span className="mr-0.5 font-medium text-primary">✨ Suggested:</span>
      {existing.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => addExisting(tag)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 hover:bg-accent"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
          <PlusIcon className="size-3 text-muted-foreground" />
        </button>
      ))}
      {newNames.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => addNew(name)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 border-dashed bg-background px-2 py-0.5 hover:bg-accent"
        >
          {name}
          <PlusIcon className="size-3 text-muted-foreground" />
        </button>
      ))}
      {remaining > 1 ? (
        <button
          type="button"
          onClick={() => accept.mutate(suggestion.id)}
          disabled={accept.isPending}
          className="text-primary hover:underline disabled:opacity-50"
        >
          Add all
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => dismiss.mutate(suggestion.id)}
        aria-label="Dismiss tag suggestions"
        className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}
