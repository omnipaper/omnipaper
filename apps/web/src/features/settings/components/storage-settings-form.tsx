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
import { type SubmitEvent, useEffect, useState } from "react";
import {
  type StorageEngineId,
  storageSettingsQuery,
  useSaveStorageSettings,
  useTestStorageConnection,
} from "@/features/settings/queries/settings";

export function StorageSettingsForm() {
  const settingsQuery = useQuery(storageSettingsQuery());
  const saveMutation = useSaveStorageSettings();
  const testMutation = useTestStorageConnection();

  const engines = settingsQuery.data?.engines ?? [];

  const [engine, setEngine] = useState("");
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
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="engine">Provider</Label>
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger id="engine" className="w-full">
                <SelectValue placeholder="Select a provider" />
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
              onClick={() => testMutation.mutate(credentials)}
              disabled={testMutation.isPending || !selected}
            >
              {testMutation.isPending ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
