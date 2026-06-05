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
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

export function OcrSettingsForm() {
  const queryClient = useQueryClient();

  const ocrQuery = useQuery({
    queryKey: ["settings", "ocr"],
    queryFn: async () => {
      const res = await api.settings.ocr.$get();
      if (!res.ok) {
        throw new Error("Failed to load OCR settings");
      }
      return res.json();
    },
  });

  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (ocrQuery.data?.configured) {
      setApiKey(ocrQuery.data.apiKey ?? "");
    }
  }, [ocrQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.settings.ocr.$put({ json: { provider: "mistral", apiKey } });
      if (!res.ok) {
        throw new Error("Failed to save OCR settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "ocr"] });
      toast.success("OCR settings saved");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.settings.ocr.test.$post({ json: { provider: "mistral", apiKey } });
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>OCR (Mistral)</CardTitle>
        <CardDescription>
          {ocrQuery.data?.configured
            ? "OCR is configured. Leave the masked key as-is to keep it."
            : "Add your Mistral API key to enable text extraction."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mistralKey">Mistral API Key</Label>
            <Input
              id="mistralKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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
