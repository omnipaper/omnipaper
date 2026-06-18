import { Link } from "@tanstack/react-router";
import {
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  MailIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { type DocumentRow, thumbnailUrl } from "@/features/documents/queries/documents";

function iconForMime(mimeType: string): ComponentType<{ className?: string }> {
  if (mimeType === "application/pdf") {
    return FileTextIcon;
  }
  if (mimeType.startsWith("image/")) {
    return FileImageIcon;
  }
  if (mimeType.startsWith("message/")) {
    return MailIcon;
  }
  if (
    mimeType === "text/csv" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheet")
  ) {
    return FileSpreadsheetIcon;
  }
  return FileIcon;
}

export function DocumentCards({ orgId, documents }: { orgId: string; documents: DocumentRow[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {documents.map((doc) => {
        const Icon = iconForMime(doc.mimeType);
        return (
          <li key={doc.id}>
            <Link
              to="/dashboard/orgs/$orgId/documents/$id"
              params={{ orgId, id: doc.id }}
              className="group flex flex-col gap-2"
            >
              <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-muted">
                {doc.thumbnailStatus === "completed" ? (
                  <img
                    src={thumbnailUrl(orgId, doc.id)}
                    alt={doc.title}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition group-hover:opacity-90"
                  />
                ) : doc.thumbnailStatus === "pending" || doc.thumbnailStatus === "processing" ? (
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className="size-10 text-muted-foreground" />
                )}
              </div>
              <span className="line-clamp-2 text-sm font-medium group-hover:underline">
                {doc.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
