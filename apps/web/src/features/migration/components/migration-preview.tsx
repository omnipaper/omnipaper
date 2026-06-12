import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Label } from "@omnipaper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { Separator } from "@omnipaper/ui/components/separator";
import { Switch } from "@omnipaper/ui/components/switch";
import { AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import {
  type MigrationPreview,
  useCancelMigration,
  useConfirmMigration,
} from "@/features/migration/queries/migrations";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function timezoneOptions(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      return ["UTC"];
    }
  }
  return ["UTC"];
}

const TAXONOMY_LABEL: Record<string, string> = {
  tag: "tags",
  documentType: "document types",
  storagePath: "storage paths",
  customField: "custom fields",
};

// Build the human-readable "won't be migrated" lines from the loss ledger (only non-zero items).
function droppedLines(preview: MigrationPreview): string[] {
  const l = preview.ledger;
  const lines: string[] = [];
  const add = (count: number, singular: string, plural: string) => {
    if (count > 0) {
      lines.push(`${count} ${count === 1 ? singular : plural}`);
    }
  };
  add(l.notes, "note", "notes");
  add(l.savedViews, "saved view", "saved views");
  add(l.workflows, "workflow", "workflows");
  add(l.droppedCustomFields, "custom field (monetary / link)", "custom fields (monetary / link)");
  add(l.perDocumentPermissions, "per-document permission", "per-document permissions");
  add(l.archiveSerialNumbers, "archive serial number", "archive serial numbers");
  add(l.trashedDocuments, "trashed document", "trashed documents");
  for (const m of l.mergedTaxonomy) {
    lines.push(
      `${m.count} ${TAXONOMY_LABEL[m.kind] ?? m.kind} named “${m.name}” will be merged into one`,
    );
  }
  for (const [model, count] of Object.entries(l.unknownModels)) {
    lines.push(`${count} × ${model} (unrecognized)`);
  }
  return lines;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-lg">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function MigrationPreviewStep({
  orgId,
  id,
  preview,
  onCancelled,
}: {
  orgId: string;
  id: string;
  preview: MigrationPreview;
  onCancelled: () => void;
}) {
  const [importOcr, setImportOcr] = useState(true);
  const [timezone, setTimezone] = useState(browserTimezone());

  const confirm = useConfirmMigration(orgId, id);
  const cancel = useCancelMigration(orgId);

  const dropped = droppedLines(preview);
  const ownedOwners = preview.ownerBreakdown.filter((o) => o.owner !== null);
  const busy = confirm.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review the import</CardTitle>
        <CardDescription>Nothing is written until you start the import.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Documents" value={preview.counts.documents} />
          <Stat label="Document types" value={preview.counts.documentTypes} />
          <Stat label="Tags" value={preview.counts.tags} />
          <Stat label="Custom properties" value={preview.counts.customPropertyDefs} />
          <Stat label="Storage paths" value={preview.counts.storagePaths} />
        </div>

        {preview.missingFiles.length > 0 ? (
          <Warning>
            <span className="font-medium">
              {preview.missingFiles.length} file
              {preview.missingFiles.length === 1 ? "" : "s"} referenced by the export are missing
              from the ZIP
            </span>
            <span className="text-muted-foreground">
              Those documents will be skipped. Re-running the Paperless export usually fixes this.
            </span>
          </Warning>
        ) : null}

        {ownedOwners.length > 0 ? (
          <Warning>
            <span className="font-medium">
              This export contains documents owned by specific users
            </span>
            <span className="text-muted-foreground">
              Paperless per-user privacy doesn't carry over — after import, everyone in this
              organization can see all of these documents.
            </span>
            <span className="text-muted-foreground text-xs">
              {ownedOwners.map((o) => `${o.owner}: ${o.documents}`).join(" · ")}
            </span>
          </Warning>
        ) : null}

        {dropped.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label>Won't be migrated</Label>
            <ul className="list-inside list-disc text-muted-foreground text-sm">
              {dropped.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="import-ocr">Import OCR text from Paperless</Label>
            <p className="text-muted-foreground text-xs">
              Reuse the text Paperless already extracted, so documents are searchable right away.
            </p>
          </div>
          <Switch id="import-ocr" checked={importOcr} onCheckedChange={setImportOcr} />
        </div>

        {preview.needsTimezone ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">Source timezone</Label>
            <p className="text-muted-foreground text-xs">
              This export uses an older date format. Pick the timezone your Paperless instance ran
              in so document dates land on the right day.
            </p>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions().map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button
            disabled={busy}
            onClick={() =>
              confirm.mutate({
                importOcr,
                timezone: preview.needsTimezone ? timezone : undefined,
              })
            }
          >
            {confirm.isPending ? "Starting…" : "Start import"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => cancel.mutate(id, { onSuccess: onCancelled })}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
