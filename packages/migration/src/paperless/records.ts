import type { IRCustomPropertyType, IRCustomValue, IRDate, IRSelectOption } from "../ir";

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asRef(value: unknown): string | null {
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" && value !== "" ? value : null;
}

export function asRefArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((v) => (typeof v === "number" ? String(v) : String(v)));
}

const DATA_TYPE_MAP: Record<string, IRCustomPropertyType> = {
  string: "text",
  long_text: "text",
  url: "url",
  date: "date",
  boolean: "boolean",
  integer: "number",
  float: "number",
  select: "select",
};

export function mapCustomFieldType(dataType: string): IRCustomPropertyType | null {
  return DATA_TYPE_MAP[dataType] ?? null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreatedDate(created: unknown): IRDate | null {
  if (typeof created !== "string" || created === "") {
    return null;
  }
  return DATE_ONLY.test(created)
    ? { kind: "date", value: created }
    : { kind: "instant", value: created };
}

export function parseSelectOptions(extraData: unknown): IRSelectOption[] {
  if (typeof extraData !== "object" || extraData === null) {
    return [];
  }
  const raw = (extraData as { select_options?: unknown }).select_options;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((opt, index) => {
    if (typeof opt === "string") {
      return { sourceId: String(index), label: opt };
    }
    if (typeof opt === "object" && opt !== null) {
      const o = opt as { id?: unknown; label?: unknown };
      const label = typeof o.label === "string" ? o.label : String(index);
      const sourceId =
        typeof o.id === "string" ? o.id : typeof o.id === "number" ? String(o.id) : String(index);
      return { sourceId, label };
    }
    return { sourceId: String(index), label: String(index) };
  });
}

/**
 * Extract a custom-field value from a `customfieldinstance` record's fields, given the field's type.
 *
 * NOTE: The exact `value_*` column names and the select-option representation are the one part of
 * this adapter NOT yet verified against a real Paperless export — this is the first thing to confirm
 * against generated fixtures (see docs/migration-paperless-implementation.md). It's deliberately
 * isolated here so a correction is a one-function edit.
 */
export function extractCustomValue(
  def: { sourceId: string; type: IRCustomPropertyType },
  fields: Record<string, unknown>,
): IRCustomValue | null {
  switch (def.type) {
    case "text": {
      const value = asString(fields.value_text) ?? asString(fields.value_long_text);
      return value === null ? null : { defSourceId: def.sourceId, kind: "text", value };
    }
    case "url": {
      const value = asString(fields.value_url) ?? asString(fields.value_text);
      return value === null ? null : { defSourceId: def.sourceId, kind: "url", value };
    }
    case "date": {
      const value = asString(fields.value_date);
      return value === null ? null : { defSourceId: def.sourceId, kind: "date", value };
    }
    case "boolean": {
      const value = fields.value_bool;
      return typeof value === "boolean"
        ? { defSourceId: def.sourceId, kind: "boolean", value }
        : null;
    }
    case "number": {
      const value = fields.value_int ?? fields.value_float;
      return typeof value === "number"
        ? { defSourceId: def.sourceId, kind: "number", value }
        : null;
    }
    case "select": {
      const raw = fields.value_select;
      const optionSourceId =
        typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
      return optionSourceId === null
        ? null
        : { defSourceId: def.sourceId, kind: "select", optionSourceId };
    }
  }
}
