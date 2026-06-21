import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Button } from "@omnipaper/ui/components/button";
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
import { useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useState } from "react";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import {
  type SystemWorkflow,
  systemWorkflowQuery,
  useSaveAutomationSettings,
} from "@/features/workflows/queries/workflows";

type Mode = "auto" | "suggest";
type FieldConfig = { enabled: boolean; mode: Mode };

const DEFAULT_FIELD: FieldConfig = { enabled: false, mode: "suggest" };

// The "front door": plain-language AI toggles that, under the hood, edit the org's single system
// workflow (origin='system'). The user never sees the word "workflow" — they pick which metadata the
// AI fills and, per field, whether to apply it directly (Auto) or stage a suggestion (Suggest).
export function AutomationSettingsForm({ orgId }: { orgId: string }) {
  const systemQuery = useQuery(systemWorkflowQuery(orgId));
  const definitionsQuery = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const save = useSaveAutomationSettings(orgId);

  const definitions = definitionsQuery.data?.definitions ?? [];

  const [enabled, setEnabled] = useState(false);
  const [documentType, setDocumentType] = useState<FieldConfig>(DEFAULT_FIELD);
  const [storagePath, setStoragePath] = useState<FieldConfig>(DEFAULT_FIELD);
  const [tags, setTags] = useState<FieldConfig>(DEFAULT_FIELD);
  const [tagsAllowNew, setTagsAllowNew] = useState(false);
  const [documentDate, setDocumentDate] = useState<FieldConfig>(DEFAULT_FIELD);
  const [customMode, setCustomMode] = useState<Mode>("suggest");
  const [customDefIds, setCustomDefIds] = useState<string[]>([]);

  // Hydrate the toggles from the stored system workflow on load.
  useEffect(() => {
    const workflow = systemQuery.data?.workflow;
    if (!workflow) {
      return;
    }
    setEnabled(workflow.enabled);
    const fields = readAiFields(workflow);
    if (!fields) {
      return;
    }
    setDocumentType(toFieldConfig(fields.documentType));
    setStoragePath(toFieldConfig(fields.storagePath));
    setTags(toFieldConfig(fields.tags));
    setTagsAllowNew(fields.tags?.allowNew ?? false);
    setDocumentDate(toFieldConfig(fields.documentDate));
    setCustomMode(fields.customFields?.mode ?? "suggest");
    setCustomDefIds(fields.customFields?.definitionIds ?? []);
  }, [systemQuery.data]);

  function toggleCustomDef(id: string, on: boolean) {
    setCustomDefIds((prev) => (on ? [...new Set([...prev, id])] : prev.filter((d) => d !== id)));
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const fields: Record<string, unknown> = {};
    if (documentType.enabled) {
      fields.documentType = { mode: documentType.mode };
    }
    if (storagePath.enabled) {
      fields.storagePath = { mode: storagePath.mode };
    }
    if (tags.enabled) {
      fields.tags = { mode: tags.mode, allowNew: tagsAllowNew, max: 6 };
    }
    if (documentDate.enabled) {
      fields.documentDate = { mode: documentDate.mode };
    }
    if (customDefIds.length > 0) {
      fields.customFields = { mode: customMode, definitionIds: customDefIds };
    }
    save.mutate({ enabled, fields });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>AI document organization</CardTitle>
        <CardDescription>
          When a document finishes processing, let AI fill its metadata. Choose Auto to apply
          directly, or Suggest to review a chip before it's set. Provider and model are configured
          under Settings → AI.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ai-enabled">Enable AI organization</Label>
              <p className="text-muted-foreground text-xs/relaxed">
                The master switch. Turn on, pick fields below, and save.
              </p>
            </div>
            <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Separator />

          <FieldRow
            label="Document type"
            value={documentType}
            onChange={setDocumentType}
          />
          <FieldRow label="Storage path" value={storagePath} onChange={setStoragePath} />
          <div className="flex flex-col gap-2">
            <FieldRow label="Tags" value={tags} onChange={setTags} />
            {tags.enabled ? (
              <label className="flex items-center gap-2 pl-1 text-muted-foreground text-xs">
                <Switch checked={tagsAllowNew} onCheckedChange={setTagsAllowNew} />
                Allow proposing new tag names (suggestions only)
              </label>
            ) : null}
          </div>
          <FieldRow label="Document date" value={documentDate} onChange={setDocumentDate} />

          {definitions.length > 0 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label>Custom properties</Label>
                  <ModeSelect
                    id="custom-mode"
                    value={customMode}
                    onChange={setCustomMode}
                    disabled={customDefIds.length === 0}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {definitions.map((definition) => (
                    <label
                      key={definition.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span>{definition.name}</span>
                      <Switch
                        checked={customDefIds.includes(definition.id)}
                        onCheckedChange={(on) => toggleCustomDef(definition.id, on)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FieldConfig;
  onChange: (next: FieldConfig) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="font-normal">{label}</Label>
      <div className="flex items-center gap-3">
        {value.enabled ? (
          <ModeSelect
            id={`mode-${label}`}
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
          />
        ) : null}
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
      </div>
    </div>
  );
}

function ModeSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Mode)} disabled={disabled}>
      <SelectTrigger id={id} size="sm" className="w-32">
        <SelectValue>{value === "auto" ? "Auto" : "Suggest"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="suggest">Suggest</SelectItem>
        <SelectItem value="auto">Auto</SelectItem>
      </SelectContent>
    </Select>
  );
}

// A stored field config is `{ mode } | undefined`; the form tracks an explicit enabled flag.
function toFieldConfig(field: { mode: Mode } | undefined): FieldConfig {
  return field ? { enabled: true, mode: field.mode } : DEFAULT_FIELD;
}

// Pull the AI action's field config out of the system workflow's definition (if present).
function readAiFields(workflow: NonNullable<SystemWorkflow>) {
  const action = workflow.definition.actions.find((a) => a.type === "ai.assignMetadata");
  return action && action.type === "ai.assignMetadata" ? action.config.fields : null;
}
