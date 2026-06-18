import { Input } from "@omnipaper/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { Switch } from "@omnipaper/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import {
  useClearDocumentPropertyValue,
  useSetDocumentPropertyValue,
} from "@/features/documents/queries/documents";

// "None" can't be an empty string in a radix Select item, so use a sentinel that maps to clearing.
const NONE_VALUE = "__none__";

type PropertyDefinition = {
  id: string;
  name: string;
  type: string;
  options: { id: string; label: string; color: string | null }[];
};

type DocumentPropertyValue = { definitionId: string; value: unknown };

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
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>— None —</SelectItem>
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
};

export function CustomPropertyFields({
  orgId,
  documentId,
  values = [],
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

  return (
    <div className="flex flex-col gap-3">
      {definitions.map((definition) => (
        <div key={definition.id} className="flex items-center gap-3">
          <span className="w-40 shrink-0 text-muted-foreground text-sm">{definition.name}</span>
          <div className="flex-1">
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
          </div>
        </div>
      ))}
    </div>
  );
}
