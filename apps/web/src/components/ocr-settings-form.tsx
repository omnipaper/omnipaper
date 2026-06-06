import { api } from "@/lib/api";
import { ocrSettingsQuery, providerSettingsQuery, settingsKeys } from "@/lib/queries/settings";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";
import { type SubmitEvent, useEffect, useState } from "react";
import { toast } from "sonner";

// The valid definition ids come from the API contract (the registry enum), not a local union.
type OcrDefinitionId = InferRequestType<typeof api.settings.ocr.$put>["json"]["definitionId"];

export function OcrSettingsForm() {
  const queryClient = useQueryClient();

  const ocrQuery = useQuery(ocrSettingsQuery());
  const providersQuery = useQuery(providerSettingsQuery());

  const definitions = ocrQuery.data?.definitions ?? [];

  const [definitionId, setDefinitionId] = useState("");
  const [model, setModel] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");

  useEffect(() => {
    if (ocrQuery.data) {
      setDefinitionId(ocrQuery.data.definitionId);
      setModel(ocrQuery.data.model);
    }
  }, [ocrQuery.data]);

  // Key fields are pre-filled with the opaque mask when a key is set: sending it back unchanged
  // keeps the stored key, blanking it clears the key (both handled server-side).
  useEffect(() => {
    if (providersQuery.data) {
      setMistralKey(providersQuery.data.mistral ?? "");
      setGoogleKey(providersQuery.data.google ?? "");
    }
  }, [providersQuery.data]);

  const selected = definitions.find((d) => d.id === definitionId);
  const requiredKey = selected?.provider === "google" ? googleKey : mistralKey;

  function selectDefinition(id: string) {
    setDefinitionId(id);
    // Suggest the chosen service's default model (only shown/used for editable LLM lanes).
    const next = definitions.find((d) => d.id === id);
    if (next) {
      setModel(next.defaultModel);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const providersRes = await api.settings.providers.$put({
        json: { mistral: mistralKey, google: googleKey },
      });
      if (!providersRes.ok) {
        throw new Error("Failed to save provider keys");
      }

      const ocrRes = await api.settings.ocr.$put({
        json: {
          definitionId: definitionId as OcrDefinitionId,
          model: selected?.modelEditable ? model : undefined,
        },
      });
      if (!ocrRes.ok) {
        throw new Error("Failed to save OCR settings");
      }
      return ocrRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.ocr() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.providers() });
      toast.success("OCR settings saved");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!selected) {
        throw new Error("Select an engine first");
      }
      const res = await api.settings.providers.test.$post({
        json: { provider: selected.provider, apiKey: requiredKey },
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

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>OCR</CardTitle>
        <CardDescription>
          {ocrQuery.data?.configured
            ? "OCR is configured. Leave a masked key as-is to keep it."
            : "Pick an engine and add the matching provider API key to enable text extraction."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="engine">Engine</Label>
            <Select value={definitionId} onValueChange={selectDefinition}>
              <SelectTrigger id="engine" className="w-full">
                <SelectValue placeholder="Select an engine" />
              </SelectTrigger>
              <SelectContent>
                {definitions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected?.modelEditable ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="modelId">Model ID</Label>
              <Input
                id="modelId"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={selected.defaultModel}
              />
            </div>
          ) : null}

          {selected ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiKey">
                {selected.provider === "google" ? "Google" : "Mistral"} API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={requiredKey}
                onChange={(e) =>
                  selected.provider === "google"
                    ? setGoogleKey(e.target.value)
                    : setMistralKey(e.target.value)
                }
              />
              {requiredKey ? null : (
                <p className="text-muted-foreground text-sm">
                  Needed to enable text extraction with {selected.label}.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
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
