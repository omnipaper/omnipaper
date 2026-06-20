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
  type OcrDefinitionId,
  ocrSettingsQuery,
  providerSettingsQuery,
  useSaveOcrSettings,
  useTestProviderConnection,
} from "@/features/settings/queries/settings";

export function OcrSettingsForm() {
  const ocrQuery = useQuery(ocrSettingsQuery());
  const providersQuery = useQuery(providerSettingsQuery());
  const saveMutation = useSaveOcrSettings();
  const testMutation = useTestProviderConnection();

  const definitions = ocrQuery.data?.definitions ?? [];

  // Init from the react-query cache so a revisit (data already cached) has the right value on the
  // FIRST render — radix Select won't reliably repaint the label if the value arrives a tick later.
  const [definitionId, setDefinitionId] = useState(() => ocrQuery.data?.definitionId ?? "");
  const [model, setModel] = useState(() => ocrQuery.data?.model ?? "");
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

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    saveMutation.mutate({
      providers: { mistral: mistralKey, google: googleKey },
      ocr: {
        definitionId: definitionId as OcrDefinitionId,
        model: selected?.modelEditable ? model : undefined,
      },
    });
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
                {/* Label passed explicitly — radix only learns an item's text when it mounts (on
                    open), so a value restored from settings wouldn't show until the dropdown opens. */}
                <SelectValue placeholder="Select an engine">{selected?.label}</SelectValue>
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
              onClick={() =>
                selected &&
                testMutation.mutate({ provider: selected.provider, apiKey: requiredKey })
              }
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
