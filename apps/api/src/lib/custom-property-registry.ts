import type { customPropertyTypeEnum } from "@omnipaper/database/schema";
import { z } from "zod";

export type CustomPropertyType = (typeof customPropertyTypeEnum.enumValues)[number];

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

export type FromDbContext = { options: Map<string, SelectOptionDto> };

export type CustomPropertyTypeDefinition = {
  type: CustomPropertyType;
  hasOptions: boolean;
  inputSchema: z.ZodTypeAny;
  toDb: (value: unknown) => ValueColumns;
  fromDb: (row: ValueColumns, ctx: FromDbContext) => unknown;
};

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

export function propertyKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
