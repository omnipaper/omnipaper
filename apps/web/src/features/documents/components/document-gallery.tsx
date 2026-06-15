import { Input } from "@omnipaper/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DocumentCards } from "@/features/documents/components/document-cards";
import { documentsListQuery } from "@/features/documents/queries/documents";

export function DocumentGallery({
  orgId,
  initialSearch = "",
  onSearchCommit,
}: {
  orgId: string;
  initialSearch?: string;
  onSearchCommit?: (query: string) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);

  const commitRef = useRef(onSearchCommit);
  commitRef.current = onSearchCommit;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = search.trim();
      setQuery(next);
      commitRef.current?.(next);
    }, 300);
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
    content = <DocumentCards orgId={orgId} documents={data.documents} />;
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
