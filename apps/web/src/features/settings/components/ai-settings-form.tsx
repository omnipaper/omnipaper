import { AI_MODELS, RECOMMENDED_MODEL } from "@omnipaper/shared/ai-models";
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
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type SubmitEvent, useEffect, useState } from "react";
import {
  type AiProviderId,
  aiSettingsQuery,
  providerSettingsQuery,
  useSaveAiSettings,
  useTestAiConnection,
} from "@/features/settings/queries/settings";

const PROVIDERS: { id: AiProviderId; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "mistral", label: "Mistral" },
];

export function AiSettingsForm() {
  const aiQuery = useQuery(aiSettingsQuery());
  const providersQuery = useQuery(providerSettingsQuery());
  const save = useSaveAiSettings();
  const test = useTestAiConnection();

  const [provider, setProvider] = useState<AiProviderId>(() => aiQuery.data?.provider ?? "openai");
  const [model, setModel] = useState<string>(() => aiQuery.data?.model ?? RECOMMENDED_MODEL);
  const [keys, setKeys] = useState<Record<AiProviderId, string>>({
    openai: "",
    anthropic: "",
    google: "",
    mistral: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (aiQuery.data) {
      setProvider(aiQuery.data.provider);
      setModel(aiQuery.data.model);
      // Open Advanced up front when a specific model is pinned, so it's visible.
      setShowAdvanced(aiQuery.data.model !== RECOMMENDED_MODEL);
    }
  }, [aiQuery.data]);

  useEffect(() => {
    if (providersQuery.data) {
      setKeys({
        openai: providersQuery.data.openai ?? "",
        anthropic: providersQuery.data.anthropic ?? "",
        google: providersQuery.data.google ?? "",
        mistral: providersQuery.data.mistral ?? "",
      });
    }
  }, [providersQuery.data]);

  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label;

  function selectProvider(next: AiProviderId) {
    setProvider(next);
    // Pinned models are provider-specific, so reset to recommended when the provider changes.
    setModel(RECOMMENDED_MODEL);
  }

  function modelLabel(value: string) {
    if (value === RECOMMENDED_MODEL) {
      return "Recommended (auto-updated)";
    }
    return AI_MODELS[provider].models.find((m) => m.id === value)?.label ?? value;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    save.mutate({ providers: keys, ai: { provider, model } });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>AI</CardTitle>
        <CardDescription>
          Provider and model for AI workflow actions. Leave a masked key as-is to keep it.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => selectProvider(v as AiProviderId)}>
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue>{providerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-key">{providerLabel} API Key</Label>
            <Input
              id="ai-key"
              type="password"
              value={keys[provider]}
              onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
            >
              {showAdvanced ? (
                <ChevronDownIcon className="size-3" />
              ) : (
                <ChevronRightIcon className="size-3" />
              )}
              Advanced settings
            </button>
            {showAdvanced ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="ai-model" className="w-full">
                    <SelectValue>{modelLabel(model)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RECOMMENDED_MODEL}>Recommended (auto-updated)</SelectItem>
                    {AI_MODELS[provider].models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() => test.mutate({ provider, apiKey: keys[provider] })}
              disabled={test.isPending}
            >
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
