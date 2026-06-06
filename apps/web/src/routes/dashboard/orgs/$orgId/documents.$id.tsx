import { CustomPropertyFields } from "@/components/custom-property-fields";
import { DocumentPreview } from "@/components/document-preview";
import { TagPicker } from "@/components/tag-picker";
import { api } from "@/lib/api";
import {
  documentActivityQuery,
  documentDetailQuery,
  documentDownloadQuery,
  documentKeys,
} from "@/lib/queries/documents";
import { useOrgMember } from "@/lib/queries/organization";
import { hasOrgPermission } from "@omnipaper/permissions";
import { Button } from "@omnipaper/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const EVENT_LABEL: Record<string, string> = {
  "document.created": "created the document",
  "document.ocr_completed": "completed OCR",
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

export const Route = createFileRoute("/dashboard/orgs/$orgId/documents/$id")({
  component: DocumentDetail,
});

function DocumentDetail() {
  const { orgId, id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const member = useOrgMember(orgId);
  const canDelete = hasOrgPermission(member?.role, { documents: ["delete"] });

  const { data, isPending, isError } = useQuery(documentDetailQuery({ orgId, id }));

  const { data: activityData } = useQuery(documentActivityQuery({ orgId, id }));

  const { data: previewData, isError: isPreviewError } = useQuery(
    documentDownloadQuery({ orgId, id }),
  );

  // The preview holds a presigned URL that eventually expires; on a load failure, drop it so the
  // next render fetches a fresh one from the API.
  const refreshPreview = () =>
    queryClient.invalidateQueries({ queryKey: documentKeys.download({ orgId, id }) });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].$delete({ param: { orgId, id } });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Document deleted");
      navigate({ to: "/dashboard/orgs/$orgId", params: { orgId } });
    },
    onError: () => {
      toast.error("Delete failed");
    },
  });

  async function handleDownload() {
    const res = await api.orgs[":orgId"].documents[":id"].download.$get({ param: { orgId, id } });
    if (!res.ok) {
      toast.error("Download failed");
      return;
    }
    const { downloadUrl } = await res.json();
    window.open(downloadUrl, "_blank", "noopener");
  }

  if (isPending) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (isError) {
    return <p className="text-destructive">Document not found.</p>;
  }

  const doc = data.document;
  const activities = activityData?.activities ?? [];

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{doc.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Type: {doc.mimeType}</p>
          <p className="text-sm text-muted-foreground">OCR status: {doc.ocrStatus}</p>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">Tags</p>
            <TagPicker orgId={orgId} documentId={id} tags={doc.tags} />
          </div>
          {doc.ocrText ? (
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
              {doc.ocrText}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No extracted text yet.</p>
          )}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleDownload}>Download</Button>
            {canDelete ? (
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <CustomPropertyFields orgId={orgId} documentId={id} values={doc.customProperties} />

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {isPreviewError ? (
            <p className="text-sm text-destructive">Could not prepare preview.</p>
          ) : (
            <DocumentPreview
              url={previewData?.downloadUrl}
              mimeType={doc.mimeType}
              title={doc.title}
              onRetry={refreshPreview}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activities.map((a) => {
                const actor = a.actorType === "system" ? "System" : (a.user?.name ?? "Unknown");
                const chars =
                  a.data && typeof a.data.characters === "number" ? a.data.characters : null;
                return (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <div className="flex flex-col">
                      <span>
                        <span className="font-medium">{actor}</span>{" "}
                        {EVENT_LABEL[a.event] ?? a.event}
                        {chars !== null ? (
                          <span className="text-muted-foreground"> ({chars} characters)</span>
                        ) : null}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        title={new Date(a.createdAt).toLocaleString()}
                      >
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
