import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ACTIVE_STATUSES,
  type MigrationDto,
  type MigrationPreview,
  migrationDetailQuery,
  migrationKeys,
  migrationsListQuery,
  type UploadProgress,
  uploadAndStartMigration,
} from "@/features/migration/queries/migrations";
import { MigrationPreviewStep } from "./migration-preview";
import { MigrationReportStep } from "./migration-report";

export function MigrationWizard({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const listQuery = useQuery(migrationsListQuery(orgId));
  const [trackedId, setTrackedId] = useState<string | null>(null);

  const resumeId =
    listQuery.data?.migrations.find((m) => ACTIVE_STATUSES.has(m.status))?.id ?? null;

  useEffect(() => {
    if (!trackedId && resumeId) {
      setTrackedId(resumeId);
    }
  }, [trackedId, resumeId]);

  const reset = () => {
    setTrackedId(null);
    queryClient.invalidateQueries({ queryKey: migrationKeys.list(orgId) });
  };

  if (trackedId) {
    return <MigrationTracker orgId={orgId} id={trackedId} onReset={reset} />;
  }
  return <MigrationStart orgId={orgId} onStarted={setTrackedId} />;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

function ExportInstructions() {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">1. Export from Paperless-ngx</p>
      <p className="text-muted-foreground">
        Run the exporter on your Paperless instance, then upload the resulting ZIP below. Your
        Paperless data is never touched.
      </p>
      <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
        <code>
          docker compose exec -T webserver document_exporter ../export \{"\n"}
          {"  "}--zip --no-archive --no-thumbnail --split-manifest
        </code>
      </pre>
      <p className="text-muted-foreground text-xs">
        Bare-metal:{" "}
        <code>
          document_exporter /path/to/export --zip --no-archive --no-thumbnail --split-manifest
        </code>
      </p>
    </div>
  );
}

function MigrationStart({ orgId, onStarted }: { orgId: string; onStarted: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const uploading = progress !== null;

  async function start() {
    if (!file) {
      return;
    }
    setProgress({ partsDone: 0, partsTotal: 1 });
    try {
      const id = await uploadAndStartMigration(orgId, file, setProgress);
      onStarted(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Migration failed to start");
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Migrate from Paperless-ngx</CardTitle>
        <CardDescription>
          Import your documents and metadata from a Paperless export.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ExportInstructions />
        <div className="flex flex-col gap-2">
          <Label htmlFor="export-file">2. Upload the export ZIP</Label>
          <Input
            id="export-file"
            type="file"
            accept=".zip,application/zip"
            disabled={uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {uploading && progress ? (
          <div className="flex flex-col gap-2">
            <ProgressBar value={progress.partsDone / progress.partsTotal} />
            <p className="text-muted-foreground text-xs">
              Uploading… part {progress.partsDone} of {progress.partsTotal}
            </p>
          </div>
        ) : (
          <Button onClick={start} disabled={!file} className="self-start">
            Start migration
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MigrationTracker({
  orgId,
  id,
  onReset,
}: {
  orgId: string;
  id: string;
  onReset: () => void;
}) {
  const { data, isPending, isError } = useQuery(migrationDetailQuery(orgId, id));

  if (isPending) {
    return <StatusCard spinner title="Loading…" />;
  }
  if (isError || !data) {
    return (
      <StatusCard
        title="Migration not found"
        body="It may have been cancelled."
        footer={
          <Button variant="outline" onClick={onReset}>
            Back
          </Button>
        }
      />
    );
  }

  const migration = data.migration;

  switch (migration.status) {
    case "created":
      return (
        <StatusCard
          title="Upload incomplete"
          body="The upload didn't finish — cancel and start over."
          footer={
            <Button variant="outline" onClick={onReset}>
              Start over
            </Button>
          }
        />
      );
    case "analyzing":
      return (
        <StatusCard
          spinner
          title="Analyzing export…"
          body="Reading the export and preparing a preview."
        />
      );
    case "awaiting_confirmation":
      return (
        <MigrationPreviewStep
          orgId={orgId}
          id={id}
          preview={migration.preview as MigrationPreview}
          onCancelled={onReset}
        />
      );
    case "importing":
      return <ImportingCard migration={migration} />;
    case "done":
      return <MigrationReportStep migration={migration} onReset={onReset} />;
    case "failed":
      return (
        <StatusCard
          title="Migration failed"
          tone="destructive"
          body={migration.error ?? "Something went wrong during the migration."}
          footer={
            <Button variant="outline" onClick={onReset}>
              Start over
            </Button>
          }
        />
      );
    default:
      return null;
  }
}

function ImportingCard({ migration }: { migration: MigrationDto }) {
  const done = migration.docsImported + migration.docsDuplicate + migration.docsFailed;
  const total = migration.docsTotal || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin" />
          Importing…
        </CardTitle>
        <CardDescription>
          You can leave this page — the import continues in the background.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ProgressBar value={total ? done / total : 0} />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            {done} of {total} documents
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {migration.docsImported} imported
          </span>
          <span className="text-muted-foreground">{migration.docsDuplicate} duplicates</span>
          {migration.docsFailed > 0 ? (
            <span className="text-destructive">{migration.docsFailed} failed</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  title,
  body,
  spinner,
  tone,
  footer,
}: {
  title: string;
  body?: string;
  spinner?: boolean;
  tone?: "destructive";
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle
          className={
            tone === "destructive"
              ? "flex items-center gap-2 text-destructive"
              : "flex items-center gap-2"
          }
        >
          {spinner ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {title}
        </CardTitle>
        {body ? <CardDescription>{body}</CardDescription> : null}
      </CardHeader>
      {footer ? <CardContent>{footer}</CardContent> : null}
    </Card>
  );
}
