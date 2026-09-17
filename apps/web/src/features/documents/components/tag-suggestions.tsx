import { Button } from "@omnipaper/ui/components/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@omnipaper/ui/components/hover-card";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { type DocumentTag, useSetDocumentTags } from "@/features/documents/queries/documents";
import {
  type DocumentSuggestion,
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/features/documents/queries/suggestions";
import { type OrgTag, orgTagsQuery, useCreateTag } from "@/features/tags/queries/tags";

// AI tag suggestions are a set, so unlike single-value fields the user picks tags one at a time
// instead of accepting the whole batch. Each pick uses the normal add-tag path; the suggestion is
// retired once its last tag is taken (or dismissed wholesale). Renders the "Suggestions" pill for
// the label row itself, so nothing shows once every suggested tag is already on the document.
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

  // Only surface what isn't on the document yet, so taking a tag makes it disappear from the list.
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
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Suggested tags"
          className="-my-0.5 inline-flex h-6 items-center gap-1 rounded-2xl bg-primary/10 px-2 font-medium text-primary text-xs transition-colors hover:bg-primary/20"
        >
          <SparklesIcon className="size-3.5" />
          Suggestions
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-60 gap-2 rounded-2xl p-2.5">
        <div className="flex flex-col gap-1">
          {existing.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 rounded-2xl bg-input/50 py-1 pr-1 pl-2.5"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-sm leading-tight">
                {tag.name}
              </span>
              <button
                type="button"
                onClick={() => addExisting(tag)}
                aria-label={`Add ${tag.name}`}
                title="Add this tag only"
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {newNames.map((name) => (
            <div
              key={name}
              className="flex items-center gap-1.5 rounded-2xl bg-input/50 py-1 pr-1 pl-2.5"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-sm leading-tight">
                {name}
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-px align-middle font-medium text-[10px] text-primary uppercase">
                  new
                </span>
              </span>
              <button
                type="button"
                onClick={() => addNew(name)}
                aria-label={`Create and add ${name}`}
                title="Create and add this tag only"
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            size="xs"
            className="flex-1"
            onClick={() => accept.mutate(suggestion.id)}
            disabled={accept.isPending}
          >
            <CheckIcon />
            Apply
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="flex-1"
            onClick={() => dismiss.mutate(suggestion.id)}
            disabled={dismiss.isPending}
          >
            <XIcon />
            Reject
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
