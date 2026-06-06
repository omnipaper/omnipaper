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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { settingsKeys, storageSettingsQuery } from "@/lib/queries/settings";

export function StorageSettingsForm() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery(storageSettingsQuery());

  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  useEffect(() => {
    const data = settingsQuery.data;
    if (data?.configured) {
      setBucket(data.bucket ?? "");
      setRegion(data.region ?? "");
      setEndpoint(data.endpoint ?? "");
      setAccessKeyId(data.accessKeyId ?? "");
      setSecretAccessKey(data.secretAccessKey ?? "");
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.settings.storage.$put({
        json: {
          bucket,
          region,
          endpoint: endpoint || undefined,
          accessKeyId,
          secretAccessKey,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.storage() });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.settings.storage.test.$post({
        json: {
          bucket,
          region,
          endpoint: endpoint || undefined,
          accessKeyId,
          secretAccessKey,
        },
      });
      if (!res.ok) {
        throw new Error("Test failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Connection successful");
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    },
    onError: () => {
      toast.error("Test failed");
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Storage (S3 / R2)</CardTitle>
        <CardDescription>
          {settingsQuery.data?.configured
            ? "Storage is configured. Leave the masked keys as-is to keep them."
            : "Configure your S3-compatible bucket."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bucket">Bucket</Label>
            <Input
              id="bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="endpoint">Endpoint (R2 / S3-compatible — optional)</Label>
            <Input
              id="endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://<account>.r2.cloudflarestorage.com"
            />
          </div>
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
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
