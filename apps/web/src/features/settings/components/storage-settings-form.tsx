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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { type SubmitEvent, useEffect, useState } from "react";
import {
  type StorageEngineId,
  storageSettingsQuery,
  useCheckStorageCors,
  useSaveStorageSettings,
  useTestStorageConnection,
} from "@/features/settings/queries/settings";

// The ready-to-paste fix when the CORS check fails — provider-specific, with the admin's own origin
// already filled in. Mirrors the config documented at /storage. We hand over the whole block rather
// than itemising what's missing: self-hosters want "paste this, here", not a CORS lecture.
function corsConfigSnippet(engine: string, origin: string): { where: string; code: string } {
  if (engine === "minio") {
    return {
      where: "Set this on your MinIO server, then restart it:",
      code: `MINIO_API_CORS_ALLOW_ORIGIN=${origin}`,
    };
  }

  const where =
    engine === "r2"
      ? "Add this to your R2 bucket → Settings → CORS Policy:"
      : "Add this to your S3 bucket → Permissions → CORS:";

  const code = JSON.stringify(
    [
      {
        AllowedOrigins: [origin],
        AllowedMethods: ["GET", "HEAD", "PUT"],
        AllowedHeaders: ["Range"],
        ExposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
        MaxAgeSeconds: 3600,
      },
    ],
    null,
    2,
  );

  return { where, code };
}

// The pass/fail verdict is shown as a toast (see useCheckStorageCors). Only the cors_missing case
// renders inline — a ready-to-paste, copyable config block doesn't fit in a transient toast.
function CorsConfig({ engine }: { engine: string }) {
  const { where, code } = corsConfigSnippet(engine, window.location.origin);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{where}</p>
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">{code}</pre>
    </div>
  );
}

export function StorageSettingsForm() {
  const settingsQuery = useQuery(storageSettingsQuery());
  const saveMutation = useSaveStorageSettings();
  const testMutation = useTestStorageConnection();
  const corsCheck = useCheckStorageCors();

  const engines = settingsQuery.data?.engines ?? [];

  // Init from the react-query cache so a revisit has the right value on the FIRST render — radix
  // Select won't reliably repaint the label if the value arrives a tick later (via the effect).
  const [engine, setEngine] = useState(() => settingsQuery.data?.engine ?? "");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;

    setEngine(data.engine);
    if (data.configured) {
      setBucket(data.bucket ?? "");
      setRegion(data.region ?? "");
      setEndpoint(data.endpoint ?? "");
      setAccessKeyId(data.accessKeyId ?? "");
      setSecretAccessKey(data.secretAccessKey ?? "");
    }
  }, [settingsQuery.data]);

  const selected = engines.find((e) => e.id === engine);

  // Only send the fields the chosen engine actually exposes — region/endpoint are derived or
  // ignored for the others, so a stale value from a previous engine never leaks into the payload.
  const credentials = {
    engine: engine as StorageEngineId,
    bucket,
    region: selected?.region.shown ? region || undefined : undefined,
    endpoint: selected?.endpoint.shown ? endpoint || undefined : undefined,
    accessKeyId,
    secretAccessKey,
  };

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(credentials);
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>
          {settingsQuery.data?.configured
            ? "Storage is configured. Leave the masked keys as-is to keep them."
            : "Pick a provider and enter your bucket credentials."}
        </CardDescription>
        <a
          href="https://docs.omnipaper.app/storage"
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 text-muted-foreground text-xs hover:text-foreground hover:underline"
        >
          Setup guide
          <ExternalLinkIcon className="size-3" />
        </a>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="engine">Provider</Label>
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger id="engine" className="w-full">
                {/* Label passed explicitly — radix only learns an item's text when it mounts (on
                    open), so a value restored from settings wouldn't show until the dropdown opens. */}
                <SelectValue placeholder="Select a provider">{selected?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {engines.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bucket">Bucket</Label>
            <Input
              id="bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              required
            />
          </div>

          {selected?.region.shown ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={selected.region.placeholder ?? undefined}
                required
              />
            </div>
          ) : null}

          {selected?.endpoint.shown ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={selected.endpoint.placeholder ?? undefined}
                required={selected.endpoint.required}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="accessKeyId">Access Key ID</Label>
            <Input
              id="accessKeyId"
              type="password"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="secretAccessKey">Secret Access Key</Label>
            <Input
              id="secretAccessKey"
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending || !selected}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => testMutation.mutate(credentials)}
              disabled={testMutation.isPending || !selected}
            >
              {testMutation.isPending ? "Testing…" : "Test connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => corsCheck.mutate(credentials)}
              disabled={corsCheck.isPending || !selected}
            >
              {corsCheck.isPending ? "Testing…" : "Test CORS"}
            </Button>
          </div>
          {corsCheck.data?.status === "cors_missing" ? <CorsConfig engine={engine} /> : null}
        </CardContent>
      </form>
    </Card>
  );
}
