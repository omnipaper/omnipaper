import { useQuery } from "@tanstack/react-query";
import {
  type DocumentActivity,
  documentActivityQuery,
} from "@/features/documents/queries/documents";

const EVENT_LABEL: Record<DocumentActivity["event"], string> = {
  "document.created": "created the document",
  "document.ocr_completed": "completed OCR",
  "document.metadata_updated": "updated document metadata",
  "document.tags_updated": "updated document tags",
  "document.property_updated": "updated document properties",
};

function timeAgo(value: string | Date) {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

export function ActivityTab({ orgId, documentId }: { orgId: string; documentId: string }) {
  const { data } = useQuery(documentActivityQuery({ orgId, id: documentId }));
  const activities = data?.activities ?? [];

  if (activities.length === 0) {
    return <p className="text-muted-foreground text-sm">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {activities.map((a) => {
        const actor = a.actorType === "system" ? "System" : (a.user?.name ?? "Unknown");
        const chars = a.data && typeof a.data.characters === "number" ? a.data.characters : null;
        return (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <div className="flex flex-col">
              <span>
                <span className="font-medium">{actor}</span> {EVENT_LABEL[a.event]}
                {chars !== null ? (
                  <span className="text-muted-foreground"> ({chars} characters)</span>
                ) : null}
              </span>
              <span
                className="text-muted-foreground text-xs"
                title={new Date(a.createdAt).toLocaleString()}
              >
                {timeAgo(a.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
