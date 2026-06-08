import { OcrStatusBadge } from "@/features/documents/components/ocr-status-badge";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";
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
import { Textarea } from "@omnipaper/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  orgId: string;
  documentId: string;
  ocrStatus: string;
  ocrText: string | null;
};

export function OcrTab({ orgId, documentId, ocrStatus, ocrText }: Props) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const inProgress = ocrStatus === "pending" || ocrStatus === "processing";

  const rerunMutation = useMutation({
    mutationFn: async () => {
      const res = await api.orgs[":orgId"].documents[":id"].process.$post({
        param: { orgId, id: documentId },
      });
      if (!res.ok) {
        throw new Error("Failed to re-run OCR");
      }
    },
    onSuccess: () => {
      // The route reset status to "pending"; refetch the detail (its refetchInterval then polls
      // until the worker settles) and the activity log so the new run shows up.
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.activity({ orgId, id: documentId }) });
      toast.success("OCR re-run started");
    },
    onError: () => toast.error("Failed to re-run OCR"),
  });

  async function handleCopy() {
    if (!ocrText) {
      return;
    }
    await navigator.clipboard.writeText(ocrText);
    setCopied(true);
    // Reset the icon after a beat so the button reads as a repeatable action, not a toggle.
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <OcrStatusBadge status={ocrStatus} />
        <div className="flex items-center gap-1">
          {ocrText ? (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={inProgress || rerunMutation.isPending}>
                <RefreshCwIcon className={inProgress ? "animate-spin" : undefined} />
                Re-run OCR
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-run OCR?</AlertDialogTitle>
                <AlertDialogDescription>
                  This replaces the current text with a fresh extraction using the configured OCR
                  engine. Any manual edits to the text will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => rerunMutation.mutate()}>Re-run</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Key on status + text so the draft rebases on any run transition (incl. failed → pending →
          failed), not only when the text changes — otherwise a re-run could leave a pre-rerun dirty
          draft saveable, contradicting the "edits will be lost" warning. */}
      <OcrTextEditor
        key={`${ocrStatus}:${ocrText ?? ""}`}
        orgId={orgId}
        documentId={documentId}
        initial={ocrText ?? ""}
        disabled={inProgress}
      />
    </div>
  );
}

function OcrTextEditor({
  orgId,
  documentId,
  initial,
  disabled,
}: {
  orgId: string;
  documentId: string;
  initial: string;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const dirty = draft !== initial;

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.orgs[":orgId"].documents[":id"]["ocr-text"].$put({
        param: { orgId, id: documentId },
        json: { ocrText: text },
      });
      if (!res.ok) {
        throw new Error("Failed to save text");
      }
    },
    onSuccess: () => {
      // exact: only the detail JSON — not the nested download (signed URL), which would remount the
      // PDF preview. Editing text re-indexes search server-side (generated column).
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail({ orgId, id: documentId }),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success("Text saved");
    },
    onError: () => toast.error("Failed to save text"),
  });

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled || saveMutation.isPending}
        placeholder={
          disabled
            ? "OCR is running…"
            : "No extracted text yet. You can type or paste the text here."
        }
        className="min-h-[50vh] font-mono text-xs"
      />
      {dirty ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(draft)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft(initial)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
