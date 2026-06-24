import type { customPropertyTypeEnum } from "@omnipaper/database/schema";
import { z } from "zod";

// One place that knows, per property type: how to validate an incoming value (inputSchema), how to
// map it onto the EAV value columns (toDb), and how to rebuild the API value from a stored row
// (fromDb). Adding a type later = one entry here; routes/queries stay type-agnostic.

export type CustomPropertyType = (typeof customPropertyTypeEnum.enumValues)[number];

// The typed value columns on document_custom_property_values. A type fills exactly one; `url`
// reuses valueText. type is immutable per definition, so a property always uses the same column.
export type ValueColumns = {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBool: boolean | null;
  selectOptionId: string | null;
};

const EMPTY_VALUE_COLUMNS: ValueColumns = {
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueBool: null,
  selectOptionId: null,
};

export type SelectOptionDto = { id: string; label: string; color: string | null };

// Context fromDb needs to resolve references — currently just the org's select options by id.
export type FromDbContext = { options: Map<string, SelectOptionDto> };

export type CustomPropertyTypeDefinition = {
  type: CustomPropertyType;
  // True for types whose value points into custom_property_select_options.
  hasOptions: boolean;
  // Shape-only validation of the raw request value. Option-ownership (does this id belong to THIS
  // property?) needs the definition's options, so it's checked in the route, not here.
  inputSchema: z.ZodTypeAny;
  toDb: (value: unknown) => ValueColumns;
  fromDb: (row: ValueColumns, ctx: FromDbContext) => unknown;
};

// Authoring helper: lets each definition work with its real value type T, while the registry stores
// the type-erased form the routes call generically.
function define<T>(def: {
  type: CustomPropertyType;
  hasOptions?: boolean;
  inputSchema: z.ZodType<T>;
  toDb: (value: T) => ValueColumns;
  fromDb: (row: ValueColumns, ctx: FromDbContext) => unknown;
}): CustomPropertyTypeDefinition {
  return {
    type: def.type,
    hasOptions: def.hasOptions ?? false,
    inputSchema: def.inputSchema,
    toDb: (value) => def.toDb(value as T),
    fromDb: def.fromDb,
  };
}

const textDef = define<string>({
  type: "text",
  inputSchema: z.string().max(10_000),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, valueText: value }),
  fromDb: (row) => row.valueText,
});

const urlDef = define<string>({
  type: "url",
  inputSchema: z.url().max(2048),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, valueText: value }),
  fromDb: (row) => row.valueText,
});

const numberDef = define<number>({
  type: "number",
  inputSchema: z.number(),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, valueNumber: value }),
  fromDb: (row) => row.valueNumber,
});

const dateDef = define<string>({
  type: "date",
  inputSchema: z.iso.date(),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, valueDate: value }),
  fromDb: (row) => row.valueDate,
});

const booleanDef = define<boolean>({
  type: "boolean",
  inputSchema: z.boolean(),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, valueBool: value }),
  fromDb: (row) => row.valueBool,
});

const selectDef = define<string>({
  type: "select",
  hasOptions: true,
  // The value is an option id; the route verifies it belongs to this property's options.
  inputSchema: z.string().min(1),
  toDb: (value) => ({ ...EMPTY_VALUE_COLUMNS, selectOptionId: value }),
  fromDb: (row, ctx) => (row.selectOptionId ? (ctx.options.get(row.selectOptionId) ?? null) : null),
});

export const customPropertyRegistry: Record<CustomPropertyType, CustomPropertyTypeDefinition> = {
  text: textDef,
  url: urlDef,
  number: numberDef,
  date: dateDef,
  boolean: booleanDef,
  select: selectDef,
};

export function getPropertyTypeDefinition(type: CustomPropertyType): CustomPropertyTypeDefinition {
  return customPropertyRegistry[type];
}

// Coerce an AI's plain-string value into the typed value columns. Used by the workflow AI executor
// (auto-apply) and the suggestion-accept route. Returns null when the string can't be coerced (bad
// number, unknown select option, or it fails the type's input schema).
export function coerceCustomValue(
  type: CustomPropertyType,
  options: { id: string; label: string }[],
  raw: string,
): ValueColumns | null {
  const def = customPropertyRegistry[type];
  if (type === "select") {
    const option = options.find((o) => o.label.toLowerCase() === raw.trim().toLowerCase());
    return option ? def.toDb(option.id) : null;
  }
  let value: unknown = raw.trim();
  if (type === "number") {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return null;
    }
    value = parsed;
  } else if (type === "boolean") {
    const lowered = raw.trim().toLowerCase();
    if (lowered !== "true" && lowered !== "false") {
      return null;
    }
    value = lowered === "true";
  }
  const result = def.inputSchema.safeParse(value);
  return result.success ? def.toDb(result.data) : null;
}

// Derive a stable, agent/MCP-facing key from a display name: "Invoice Amount" -> "invoice_amount".
// Returns "" when the name has no alphanumerics — the route rejects that.
export function propertyKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
