import { hasOrgPermission } from "@omnipaper/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@omnipaper/ui/components/alert-dialog";
import { Button } from "@omnipaper/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omnipaper/ui/components/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { ActivityTab } from "@/features/documents/components/document-detail/activity-tab";
import { DetailsTab } from "@/features/documents/components/document-detail/details-tab";
import { OcrTab } from "@/features/documents/components/document-detail/ocr-tab";
import { DocumentPreview } from "@/features/documents/components/document-preview";
import {
  documentDetailQuery,
  documentDownloadQuery,
  documentKeys,
  useDeleteDocument,
} from "@/features/documents/queries/documents";
import { pushRecent } from "@/features/documents/recent/recent-documents-store";
import { useOrgMember } from "@/features/organization/queries/organization";
import { api } from "@/lib/api";

export function DocumentDetail({ orgId, id }: { orgId: string; id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const member = useOrgMember(orgId);
  const canDelete = hasOrgPermission(member?.role, { documents: ["delete"] });

  const { data, isPending, isError } = useQuery(documentDetailQuery({ orgId, id }));
  const { data: previewData, isError: isPreviewError } = useQuery(
    documentDownloadQuery({ orgId, id }),
  );

  // The preview holds a presigned URL that eventually expires; on a load failure, drop it so the
  // next render fetches a fresh one from the API.
  const refreshPreview = () =>
    queryClient.invalidateQueries({ queryKey: documentKeys.download({ orgId, id }) });

  const deleteDocument = useDeleteDocument(orgId);

  // Record this doc as "open" once the detail actually loads — that's a confirmed open (not a 404,
  // and it catches direct-URL / back-forward navigation a click handler would miss). Keyed on the
  // title so it fires once per open, NOT on every OCR refetch (the detail re-polls every 3s while
  // processing); revisiting an already-open doc is a no-op in the store anyway.
  const openTitle = data?.document.title;
  useEffect(() => {
    if (openTitle === undefined) return;
    pushRecent(orgId, { id, title: openTitle });
  }, [orgId, id, openTitle]);

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
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  if (isError) {
    return <p className="p-6 text-destructive">Document not found.</p>;
  }

  const doc = data.document;

  return (
    <div className="flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Left: info panel — header of actions + tabbed metadata. Owns its own scroll on lg. */}
      <div className="flex flex-col border-b lg:w-[400px] lg:shrink-0 lg:overflow-hidden lg:border-r lg:border-b-0">
        <div className="flex shrink-0 flex-col gap-3 border-b p-4">
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/orgs/$orgId/documents" params={{ orgId }}>
                <ArrowLeftIcon />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <DownloadIcon />
                Download
              </Button>
              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label="Delete document"
                      disabled={deleteDocument.isPending}
                    >
                      <Trash2Icon />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes “{doc.title}” and its extracted text. This can’t be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          deleteDocument.mutate(id, {
                            onSuccess: () =>
                              navigate({
                                to: "/dashboard/orgs/$orgId/documents",
                                params: { orgId },
                              }),
                          })
                        }
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="truncate font-semibold text-lg" title={doc.title}>
              {doc.title}
            </h1>
            <p className="text-muted-foreground text-xs">{doc.mimeType}</p>
          </div>
        </div>

        <Tabs defaultValue="details" className="flex flex-col gap-0 lg:min-h-0 lg:flex-1">
          <TabsList className="mx-4 mt-3 grid grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="ocr">OCR</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <TabsContent value="details">
              <DetailsTab
                orgId={orgId}
                documentId={id}
                title={doc.title}
                documentDate={doc.documentDate}
                documentType={doc.documentType}
                storagePath={doc.storagePath}
                tags={doc.tags}
                customProperties={doc.customProperties}
              />
            </TabsContent>
            <TabsContent value="ocr">
              <OcrTab
                orgId={orgId}
                documentId={id}
                ocrStatus={doc.ocrStatus}
                ocrText={doc.ocrText}
                ocrSupported={doc.ocrSupported}
              />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab orgId={orgId} documentId={id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Right: preview pane — fills the rest, scrolls independently on lg. */}
      <div className="bg-muted/30 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4">
          {isPreviewError ? (
            <p className="text-destructive text-sm">Could not prepare preview.</p>
          ) : (
            <DocumentPreview
              url={previewData?.downloadUrl}
              mimeType={doc.mimeType}
              title={doc.title}
              onRetry={refreshPreview}
            />
          )}
        </div>
      </div>
    </div>
  );
}
