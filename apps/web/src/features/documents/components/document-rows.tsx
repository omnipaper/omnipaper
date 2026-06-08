import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { OcrStatusBadge } from "@/features/documents/components/ocr-status-badge";
import type { DocumentRow } from "@/features/documents/queries/documents";
import { TagChip } from "@/features/tags/components/tag-chip";

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

// Renders the list of document rows (links to the detail view). Callers handle loading / error /
// empty states, since those differ per view.
export function DocumentRows({ orgId, documents }: { orgId: string; documents: DocumentRow[] }) {
  return (
    <ul className="divide-y rounded-md border">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            to="/dashboard/orgs/$orgId/documents/$id"
            params={{ orgId, id: doc.id }}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{doc.title}</span>
              <OcrStatusBadge status={doc.ocrStatus} />
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
