import { orgPropertyDefinitionsQuery } from "@/features/custom-properties/queries/custom-properties";
import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";
import { Input } from "@omnipaper/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { Switch } from "@omnipaper/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  disabled: boolean;
  onSet: (value: unknown) => void;
  onClear: () => void;
};

function PropertyValueEditor({ definition, value, disabled, onSet, onClear }: EditorProps) {
  if (definition.type === "boolean") {
    return (
      <Switch
        checked={value === true}
        disabled={disabled}
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
        disabled={disabled}
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
        disabled={disabled}
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
        disabled={disabled}
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
      disabled={disabled}
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
  const queryClient = useQueryClient();
  const { data } = useQuery(orgPropertyDefinitionsQuery({ orgId }));
  const definitions = data?.definitions ?? [];
  const valueByDefinition = new Map(values.map((v) => [v.definitionId, v.value]));

  function invalidate() {
    // exact: refetch only the detail JSON, not the nested download/activity (which would remount
    // the PDF preview). Editing a property only changes the detail payload.
    queryClient.invalidateQueries({
      queryKey: documentKeys.detail({ orgId, id: documentId }),
      exact: true,
    });
  }

  const setValueMutation = useMutation({
    mutationFn: async (vars: { definitionId: string; value: unknown }) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$put({
        param: { orgId, id: documentId, definitionId: vars.definitionId },
        json: { value: vars.value },
      });
      if (!res.ok) {
        throw new Error("Failed to save property");
      }
    },
    onSuccess: invalidate,
    // Revert the uncontrolled field to server truth instead of leaving a typed-but-unsaved value.
    onError: () => {
      invalidate();
      toast.error("Failed to save property");
    },
  });

  const clearValueMutation = useMutation({
    mutationFn: async (definitionId: string) => {
      const res = await api.orgs[":orgId"].documents[":id"]["custom-properties"][
        ":definitionId"
      ].$delete({ param: { orgId, id: documentId, definitionId } });
      if (!res.ok) {
        throw new Error("Failed to clear property");
      }
    },
    onSuccess: invalidate,
    onError: () => {
      invalidate();
      toast.error("Failed to clear property");
    },
  });

  // Properties are defined in settings; with none defined there's nothing to edit here.
  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {definitions.map((definition) => {
        // Disable only the field whose save is in flight, so editing another field meanwhile
        // isn't swallowed.
        const fieldPending =
          (setValueMutation.isPending &&
            setValueMutation.variables?.definitionId === definition.id) ||
          (clearValueMutation.isPending && clearValueMutation.variables === definition.id);

        return (
          <div key={definition.id} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-muted-foreground text-sm">{definition.name}</span>
            <div className="flex-1">
              <PropertyValueEditor
                definition={definition}
                value={valueByDefinition.get(definition.id)}
                disabled={fieldPending}
                onSet={(value) => setValueMutation.mutate({ definitionId: definition.id, value })}
                onClear={() => clearValueMutation.mutate(definition.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
