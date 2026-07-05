import { ACTION_DEFINITIONS } from "@omnipaper/shared/workflows/actions";
import {
  TRIGGER_DEFINITIONS,
  TRIGGER_IDS,
  type TriggerId,
} from "@omnipaper/shared/workflows/triggers";
import { Button } from "@omnipaper/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { Switch } from "@omnipaper/ui/components/switch";
import { PlusIcon, SparklesIcon, TagIcon, XIcon, ZapIcon } from "lucide-react";
import { type ReactNode, type SubmitEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PropertyDefinition } from "@/features/custom-properties/queries/custom-properties";
import type { OrgTag } from "@/features/tags/queries/tags";
import {
  type CreateWorkflowBody,
  useCreateWorkflow,
  useUpdateWorkflow,
  type Workflow,
} from "@/features/workflows/queries/workflows";

type Mode = "apply" | "suggest";
type ActionType = "tag.add" | "tag.remove" | "ai.assignMetadata";

const AI_FIELDS = [
  { key: "documentType", label: "Document type" },
  { key: "storagePath", label: "Storage path" },
  { key: "tags", label: "Tags" },
  { key: "documentDate", label: "Document date" },
  { key: "title", label: "Title" },
] as const;
type AiFieldKey = (typeof AI_FIELDS)[number]["key"];

type DraftCustomField = { mode: Mode; allowNew: boolean };

type DraftAction = {
  key: string;
  type: ActionType;
  tagId: string;
  fields: Partial<Record<AiFieldKey, Mode>>;
  allowNew: boolean;
  customFields: Record<string, DraftCustomField>;
};

const ACTION_OPTIONS: { id: ActionType; label: string }[] = [
  { id: "tag.add", label: ACTION_DEFINITIONS["tag.add"].label },
  { id: "tag.remove", label: ACTION_DEFINITIONS["tag.remove"].label },
];

function newAction(): DraftAction {
  return {
    key: crypto.randomUUID(),
    type: "tag.add",
    tagId: "",
    fields: {},
    allowNew: false,
    customFields: {},
  };
}

function hydrateActions(actions: Workflow["definition"]["actions"]): DraftAction[] {
  return actions.map((action) => {
    if (action.type === "ai.assignMetadata") {
      const config = action.config;
      const fields: Partial<Record<AiFieldKey, Mode>> = {};
      if (config.documentType) {
        fields.documentType = config.documentType.mode;
      }
      if (config.storagePath) {
        fields.storagePath = config.storagePath.mode;
      }
      if (config.tags) {
        fields.tags = config.tags.mode;
      }
      if (config.documentDate) {
        fields.documentDate = config.documentDate.mode;
      }
      if (config.title) {
        fields.title = config.title.mode;
      }
      return {
        key: crypto.randomUUID(),
        type: "ai.assignMetadata",
        tagId: "",
        fields,
        allowNew: config.tags?.allowNew ?? false,
        customFields: Object.fromEntries(
          (config.customFields ?? []).map((e) => [
            e.definitionId,
            { mode: e.mode, allowNew: e.allowNew ?? false },
          ]),
        ),
      };
    }
    return {
      key: crypto.randomUUID(),
      type: action.type,
      tagId: action.config.tagId,
      fields: {},
      allowNew: false,
      customFields: {},
    };
  });
}

function FlowConnector() {
  return <div className="ml-7 h-4 w-px bg-border" />;
}

function FlowNode({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 shadow-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export function WorkflowBuilder({
  orgId,
  tags,
  properties,
  workflow,
  onDone,
}: {
  orgId: string;
  tags: OrgTag[];
  properties: PropertyDefinition[];
  workflow?: Workflow;
  onDone?: () => void;
}) {
  const create = useCreateWorkflow(orgId);
  const update = useUpdateWorkflow(orgId);
  const isEditing = workflow !== undefined;
  const isSystem = workflow?.systemKey != null;
  const pending = create.isPending || update.isPending;

  const [name, setName] = useState(() => workflow?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerId>(
    () => workflow?.definition.trigger.type ?? "document.created",
  );
  const [actions, setActions] = useState<DraftAction[]>(() =>
    workflow ? hydrateActions(workflow.definition.actions) : [newAction()],
  );
  const [enabled, setEnabled] = useState(() => workflow?.enabled ?? true);

  const hasTags = tags.length > 0;
  const usesTags = actions.some((a) => a.type !== "ai.assignMetadata");
  const needsText = actions.some((a) => ACTION_DEFINITIONS[a.type].requiresText);
  const triggerOptions = TRIGGER_IDS.filter(
    (id) => !needsText || TRIGGER_DEFINITIONS[id].providesText,
  );

  useEffect(() => {
    if (needsText && !TRIGGER_DEFINITIONS[triggerType].providesText) {
      const textTrigger = TRIGGER_IDS.find((id) => TRIGGER_DEFINITIONS[id].providesText);
      if (textTrigger) {
        setTriggerType(textTrigger);
      }
    }
  }, [needsText, triggerType]);

  const canSubmit =
    name.trim().length > 0 &&
    actions.length > 0 &&
    actions.every((a) =>
      a.type === "ai.assignMetadata"
        ? Object.keys(a.fields).length > 0 || Object.keys(a.customFields).length > 0
        : a.tagId.length > 0,
    ) &&
    !pending;

  function updateAction(key: string, patch: Partial<Omit<DraftAction, "key">>) {
    setActions((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  function toggleAiField(key: string, field: AiFieldKey, on: boolean) {
    setActions((prev) =>
      prev.map((a) => {
        if (a.key !== key) {
          return a;
        }
        const fields = { ...a.fields };
        if (on) {
          fields[field] = "suggest";
        } else {
          delete fields[field];
        }
        return { ...a, fields };
      }),
    );
  }

  function setAiFieldMode(key: string, field: AiFieldKey, mode: Mode) {
    setActions((prev) =>
      prev.map((a) => (a.key === key ? { ...a, fields: { ...a.fields, [field]: mode } } : a)),
    );
  }

  function toggleCustomField(key: string, id: string, on: boolean) {
    setActions((prev) =>
      prev.map((a) => {
        if (a.key !== key) {
          return a;
        }
        const customFields = { ...a.customFields };
        if (on) {
          customFields[id] = { mode: "suggest", allowNew: false };
        } else {
          delete customFields[id];
        }
        return { ...a, customFields };
      }),
    );
  }

  function updateCustomField(key: string, id: string, patch: Partial<DraftCustomField>) {
    setActions((prev) =>
      prev.map((a) => {
        const entry = a.customFields[id];
        if (a.key !== key || !entry) {
          return a;
        }
        return { ...a, customFields: { ...a.customFields, [id]: { ...entry, ...patch } } };
      }),
    );
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const builtActions = actions.map((a, i) => {
      const id = `a${i + 1}`;
      if (a.type === "ai.assignMetadata") {
        const config: {
          documentType?: { mode: Mode };
          storagePath?: { mode: Mode };
          tags?: { mode: Mode; allowNew: boolean };
          documentDate?: { mode: Mode };
          title?: { mode: Mode };
          customFields?: { definitionId: string; mode: Mode; allowNew?: boolean }[];
        } = {};
        if (a.fields.documentType) {
          config.documentType = { mode: a.fields.documentType };
        }
        if (a.fields.storagePath) {
          config.storagePath = { mode: a.fields.storagePath };
        }
        if (a.fields.tags) {
          config.tags = { mode: a.fields.tags, allowNew: a.allowNew };
        }
        if (a.fields.documentDate) {
          config.documentDate = { mode: a.fields.documentDate };
        }
        if (a.fields.title) {
          config.title = { mode: a.fields.title };
        }
        const customEntries = Object.entries(a.customFields);
        if (customEntries.length > 0) {
          config.customFields = customEntries.map(([definitionId, v]) => ({
            definitionId,
            mode: v.mode,
            ...(v.allowNew ? { allowNew: true } : {}),
          }));
        }
        return { id, type: "ai.assignMetadata" as const, config };
      }
      if (a.type === "tag.remove") {
        return { id, type: "tag.remove" as const, config: { tagId: a.tagId } };
      }
      return { id, type: "tag.add" as const, config: { tagId: a.tagId } };
    });

    const definition: CreateWorkflowBody["definition"] = {
      schemaVersion: 1,
      trigger: { type: triggerType, config: {} },
      ...(workflow?.definition.filter ? { filter: workflow.definition.filter } : {}),
      actions: builtActions,
    };

    // Saving stays on the page — the user may keep tweaking; Back/Cancel are the way out.
    if (isEditing && workflow) {
      update.mutate(
        { id: workflow.id, body: { name: name.trim(), enabled, definition } },
        { onSuccess: () => toast.success("Workflow saved") },
      );
      return;
    }

    create.mutate(
      { name: name.trim(), enabled, definition },
      {
        onSuccess: () => {
          setName("");
          setActions([newAction()]);
          setEnabled(true);
          onDone?.();
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit workflow" : "New workflow"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag new documents"
            />
          </div>

          {usesTags && !hasTags ? (
            <p className="text-muted-foreground text-sm">Create a tag first to use tag actions.</p>
          ) : null}

          <div className="flex flex-col">
            <FlowNode icon={<ZapIcon className="size-4" />}>
              <span className="text-muted-foreground text-xs">When</span>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerId)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{TRIGGER_DEFINITIONS[triggerType].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((id) => (
                    <SelectItem key={id} value={id}>
                      {TRIGGER_DEFINITIONS[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {needsText ? (
                <span className="text-muted-foreground text-xs">
                  Runs after the document is processed, because an AI step needs its text.
                </span>
              ) : null}
            </FlowNode>

            {actions.map((action) => (
              <div key={action.key} className="flex flex-col">
                <FlowConnector />
                <FlowNode
                  icon={
                    action.type === "ai.assignMetadata" ? (
                      <SparklesIcon className="size-4" />
                    ) : (
                      <TagIcon className="size-4" />
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    {action.type === "ai.assignMetadata" ? (
                      <span className="flex-1 font-medium text-sm">
                        {ACTION_DEFINITIONS["ai.assignMetadata"].label}
                      </span>
                    ) : (
                      <>
                        <Select
                          value={action.type}
                          onValueChange={(v) => updateAction(action.key, { type: v as ActionType })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {ACTION_OPTIONS.find((o) => o.id === action.type)?.label}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_OPTIONS.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActions((prev) => prev.filter((a) => a.key !== action.key))
                          }
                          aria-label="Remove step"
                        >
                          <XIcon className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {action.type === "ai.assignMetadata" ? (
                    <div className="flex flex-col gap-2">
                      {AI_FIELDS.map((f) => {
                        const mode = action.fields[f.key];
                        return (
                          <div key={f.key} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={mode !== undefined}
                                onCheckedChange={(on) => toggleAiField(action.key, f.key, on)}
                              />
                              <span className="flex-1 text-sm">{f.label}</span>
                              {mode ? (
                                <Select
                                  value={mode}
                                  onValueChange={(m) =>
                                    setAiFieldMode(action.key, f.key, m as Mode)
                                  }
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="apply">Apply</SelectItem>
                                    <SelectItem value="suggest">Suggest</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : null}
                            </div>
                            {f.key === "tags" && mode ? (
                              <div className="flex items-center gap-2 pl-7 text-muted-foreground text-xs">
                                <Switch
                                  checked={action.allowNew}
                                  onCheckedChange={(on) =>
                                    updateAction(action.key, { allowNew: on })
                                  }
                                />
                                Let AI add tags that don't exist yet
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {properties.length > 0 ? (
                        <div className="flex flex-col gap-2 border-t pt-2">
                          <span className="text-sm">Custom fields</span>
                          {properties.map((p) => {
                            const entry = action.customFields[p.id];
                            return (
                              <div key={p.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={entry !== undefined}
                                    onCheckedChange={(on) =>
                                      toggleCustomField(action.key, p.id, on)
                                    }
                                  />
                                  <span className="flex-1 text-sm">{p.name}</span>
                                  {entry ? (
                                    <Select
                                      value={entry.mode}
                                      onValueChange={(m) =>
                                        updateCustomField(action.key, p.id, { mode: m as Mode })
                                      }
                                    >
                                      <SelectTrigger className="w-36">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="apply">Apply</SelectItem>
                                        <SelectItem value="suggest">Suggest</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : null}
                                </div>
                                {p.type === "select" && entry ? (
                                  <div className="flex items-center gap-2 pl-7 text-muted-foreground text-xs">
                                    <Switch
                                      checked={entry.allowNew}
                                      onCheckedChange={(on) =>
                                        updateCustomField(action.key, p.id, {
                                          allowNew: on,
                                        })
                                      }
                                    />
                                    Let AI add options that don't exist yet
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <Select
                      value={action.tagId}
                      onValueChange={(v) => updateAction(action.key, { tagId: v })}
                      disabled={!hasTags}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={hasTags ? "Select a tag" : "No tags yet"}>
                          {tags.find((t) => t.id === action.tagId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FlowNode>
              </div>
            ))}

            {isSystem ? null : (
              <>
                <FlowConnector />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setActions((prev) => [...prev, newAction()])}
                >
                  <PlusIcon className="size-4" />
                  Add step
                </Button>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {pending
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save changes"
                  : "Create workflow"}
            </Button>
            {isEditing ? (
              <Button type="button" variant="ghost" onClick={() => onDone?.()}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
