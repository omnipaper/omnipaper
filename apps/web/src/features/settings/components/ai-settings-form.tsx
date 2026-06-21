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
  type AiProviderId,
  aiSettingsQuery,
  providerSettingsQuery,
  type TestProviderInput,
  useSaveAiSettings,
  useTestProviderConnection,
} from "@/features/settings/queries/settings";

// Mirrors the OCR settings form: pick the chat-LLM provider + model and supply the matching key. The
// model is always free-text (defaults to the provider's suggestion). Keys are shared with OCR, so a
// key already set for OCR (mistral/google) is reused here.
export function AiSettingsForm() {
  const aiQuery = useQuery(aiSettingsQuery());
  const providersQuery = useQuery(providerSettingsQuery());
  const saveMutation = useSaveAiSettings();
  const testMutation = useTestProviderConnection();

  const providers = aiQuery.data?.providers ?? [];

  const [provider, setProvider] = useState(() => aiQuery.data?.provider ?? "");
  const [model, setModel] = useState(() => aiQuery.data?.model ?? "");
  const [keys, setKeys] = useState({ mistral: "", google: "", openai: "", anthropic: "" });

  useEffect(() => {
    if (aiQuery.data) {
      setProvider(aiQuery.data.provider);
      setModel(aiQuery.data.model);
    }
  }, [aiQuery.data]);

  // Key fields pre-fill with the opaque mask when set: re-sending it unchanged keeps the stored key,
  // blanking clears it (both handled server-side).
  useEffect(() => {
    if (providersQuery.data) {
      setKeys({
        mistral: providersQuery.data.mistral ?? "",
        google: providersQuery.data.google ?? "",
        openai: providersQuery.data.openai ?? "",
        anthropic: providersQuery.data.anthropic ?? "",
      });
    }
  }, [providersQuery.data]);

  const selected = providers.find((p) => p.id === provider);
  const currentKey = keys[provider as keyof typeof keys] ?? "";

  function selectProvider(id: string) {
    setProvider(id);
    const next = providers.find((p) => p.id === id);
    if (next) {
      setModel(next.defaultModel);
    }
  }

  function setKey(value: string) {
    setKeys((prev) => ({ ...prev, [provider]: value }));
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    saveMutation.mutate({
      providers: keys,
      ai: { provider: provider as AiProviderId, model },
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>AI</CardTitle>
        <CardDescription>
          {aiQuery.data?.configured
            ? "AI is configured. Leave a masked key as-is to keep it."
            : "Pick a provider and add its API key to enable AI metadata assignment."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={selectProvider}>
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue placeholder="Select a provider">{selected?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-model">Model ID</Label>
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={selected.defaultModel}
              />
            </div>
          ) : null}

          {selected ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-key">{selected.label} API Key</Label>
              <Input
                id="ai-key"
                type="password"
                value={currentKey}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() =>
                selected &&
                testMutation.mutate({
                  provider: provider as TestProviderInput["provider"],
                  apiKey: currentKey,
                })
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
