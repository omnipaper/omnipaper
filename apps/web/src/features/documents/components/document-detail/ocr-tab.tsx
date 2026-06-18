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
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { OcrStatusBadge } from "@/features/documents/components/ocr-status-badge";
import {
  type OcrStatus,
  useReprocessDocument,
  useUpdateOcrText,
} from "@/features/documents/queries/documents";

type Props = {
  orgId: string;
  documentId: string;
  ocrStatus: OcrStatus;
  ocrText: string | null;
  ocrSupported: boolean;
};

export function OcrTab({ orgId, documentId, ocrStatus, ocrText, ocrSupported }: Props) {
  const [copied, setCopied] = useState(false);
  const inProgress = ocrStatus === "pending" || ocrStatus === "processing";

  const rerun = useReprocessDocument(orgId, documentId);

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
              <Button
                variant="outline"
                size="sm"
                disabled={inProgress || rerun.isPending || !ocrSupported}
              >
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
                <AlertDialogAction onClick={() => rerun.mutate()}>Re-run</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {!ocrSupported ? (
        <p className="text-muted-foreground text-xs">
          The configured OCR engine can’t extract text from this file type. You can still add text
          manually below.
        </p>
      ) : null}

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
  const [draft, setDraft] = useState(initial);
  const dirty = draft !== initial;

  const save = useUpdateOcrText(orgId, documentId);

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled || save.isPending}
        placeholder={
          disabled
            ? "OCR is running…"
            : "No extracted text yet. You can type or paste the text here."
        }
        className="min-h-[50vh] font-mono text-xs"
      />
      {dirty ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => save.mutate(draft)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft(initial)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
