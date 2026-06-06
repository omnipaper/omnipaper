import { TagChip } from "@/components/tag-chip";
import { documentsListQuery } from "@/lib/queries/documents";
import { Input } from "@omnipaper/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect, useState } from "react";

function renderSnippet(snippet: string) {
  return snippet.split(/(<mark>.*?<\/mark>)/g).map((part, index) => {
    const isMark = part.startsWith("<mark>");
    return {
      key: index,
      isMark,
      text: isMark ? part.slice("<mark>".length, -"</mark>".length) : part,
    };
  });
}

export function DocumentList({ orgId }: { orgId: string }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending, isError } = useQuery(documentsListQuery({ orgId, query }));

  let content: ReactNode;

  if (isPending) {
    content = <p className="text-muted-foreground">Loading…</p>;
  } else if (isError) {
    content = <p className="text-destructive">Failed to load documents.</p>;
  } else if (!data || data.documents.length === 0) {
    content = (
      <p className="text-muted-foreground">
        {query ? "No documents match your search." : "No documents yet. Upload one above."}
      </p>
    );
  } else {
    content = (
      <ul className="divide-y rounded-md border">
        {data.documents.map((doc) => (
          <li key={doc.id}>
            <Link
              to="/dashboard/orgs/$orgId/documents/$id"
              params={{ orgId, id: doc.id }}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{doc.title}</span>
                <span className="text-sm text-muted-foreground">{doc.ocrStatus}</span>
              </div>
              {doc.snippet ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {renderSnippet(doc.snippet).map((part) =>
                    part.isMark ? (
                      <mark key={part.key} className="rounded bg-yellow-200 text-foreground">
                        {part.text}
                      </mark>
                    ) : (
                      <Fragment key={part.key}>{part.text}</Fragment>
                    ),
                  )}
                </p>
              ) : null}
              {doc.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <TagChip key={tag.id} name={tag.name} color={tag.color} />
                  ))}
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder="Search documents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {content}
    </div>
  );
}
