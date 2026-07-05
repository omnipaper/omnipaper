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
import { useQuery } from "@tanstack/react-query";
import { NONE_LABEL } from "@/components/creatable-combobox";
import {
  orgPropertyDefinitionsQuery,
  type PropertyDefinition,
} from "@/features/custom-properties/queries/custom-properties";
import { InlineSuggestion } from "@/features/documents/components/inline-suggestion";
import {
  type DocumentDetail,
  useClearDocumentPropertyValue,
  useSetDocumentPropertyValue,
} from "@/features/documents/queries/documents";
import type { DocumentSuggestion } from "@/features/documents/queries/suggestions";

// "None" can't be an empty string in a radix Select item, so use a sentinel that maps to clearing.
const NONE_VALUE = "__none__";

type DocumentPropertyValue = DocumentDetail["customProperties"][number];

type EditorProps = {
  definition: PropertyDefinition;
  value: unknown;
  onSet: (value: unknown) => void;
  onClear: () => void;
};

// Edits are optimistic, so the field never disables while a save is in flight — the value updates
// instantly and reconciles on settle.
function PropertyValueEditor({ definition, value, onSet, onClear }: EditorProps) {
  if (definition.type === "boolean") {
    return (
      <Switch
        checked={value === true}
        aria-label={definition.name}
        onCheckedChange={(c) => onSet(c)}
      />
    );
  }

  if (definition.type === "select") {
    const optionId =
      value && typeof value === "object" && "id" in value
        ? String((value as { id: unknown }).id)
        : "";

    return (
      <Select
        value={optionId || NONE_VALUE}
        onValueChange={(v) => {
          if (v === NONE_VALUE) {
            onClear();
          } else {
            onSet(v);
          }
        }}
      >
        <SelectTrigger className="w-full" aria-label={definition.name}>
          <SelectValue placeholder={NONE_LABEL} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{NONE_LABEL}</SelectItem>
          {definition.options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (definition.type === "number") {
    const current = typeof value === "number" ? value : undefined;
    return (
      <Input
        key={String(current ?? "")}
        type="number"
        defaultValue={current ?? ""}
        aria-label={definition.name}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            if (current !== undefined) {
              onClear();
            }
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n !== current) {
            onSet(n);
          }
        }}
      />
    );
  }

  if (definition.type === "date") {
    const current = typeof value === "string" ? value : "";
    return (
      <Input
        key={current}
        type="date"
        defaultValue={current}
        aria-label={definition.name}
        onChange={(e) => {
          const v = e.target.value;
          if (v === current) {
            return;
          }
          if (v) {
            onSet(v);
          } else {
            onClear();
          }
        }}
      />
    );
  }

  const current = typeof value === "string" ? value : "";
  return (
    <Input
      key={current}
      type={definition.type === "url" ? "url" : "text"}
      defaultValue={current}
      aria-label={definition.name}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === current) {
          return;
        }
        if (v) {
          onSet(v);
        } else {
          onClear();
        }
      }}
    />
  );
}

type CustomPropertyFieldsProps = {
  orgId: string;
  documentId: string;
  values: DocumentPropertyValue[];
  suggestions?: DocumentSuggestion[];
};

export function CustomPropertyFields({
  orgId,
  documentId,
  values = [],
  suggestions = [],
}: CustomPropertyFieldsProps) {
  const { data } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const definitions = data?.definitions ?? [];
  const valueByDefinition = new Map(values.map((v) => [v.definitionId, v.value]));

  const setValue = useSetDocumentPropertyValue(orgId, documentId);
  const clearValue = useClearDocumentPropertyValue(orgId, documentId);

  // Properties are defined in settings; with none defined there's nothing to edit here.
  if (definitions.length === 0) {
    return null;
  }

  function getSuggestionLabel(
    definition: PropertyDefinition,
    suggestion: DocumentSuggestion,
  ): string {
    const value = suggestion.suggestedValue;
    if ("selectOptionId" in value) {
      return definition.options.find((o) => o.id === value.selectOptionId)?.label ?? "?";
    }
    if ("newOptionLabel" in value) {
      return `${value.newOptionLabel} (new option)`;
    }
    if ("value" in value) {
      return value.value;
    }
    return "";
  }

  return (
    <div className="flex flex-col gap-4">
      {definitions.map((definition) => {
        const suggestion = suggestions.find((s) => s.customPropertyDefinitionId === definition.id);

        return (
          <div key={definition.id} className="flex flex-col gap-1.5">
            <Label>{definition.name}</Label>
            <PropertyValueEditor
              definition={definition}
              value={valueByDefinition.get(definition.id)}
              // A select sends a bare option id to the API, but the detail stores the resolved
              // { id, label, color }; resolve it here so the optimistic patch matches server shape.
              onSet={(value) => {
                const optimisticValue =
                  definition.type === "select"
                    ? (definition.options.find((o) => o.id === value) ?? null)
                    : value;
                setValue.mutate({ definitionId: definition.id, value, optimisticValue });
              }}
              onClear={() => clearValue.mutate(definition.id)}
            />
            {suggestion && (
              <InlineSuggestion
                orgId={orgId}
                documentId={documentId}
                suggestionId={suggestion.id}
                label={getSuggestionLabel(definition, suggestion)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
