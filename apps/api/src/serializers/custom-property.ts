import type {
  getDocumentPropertyValues,
  getOrgPropertyDefinitions,
} from "@omnipaper/database/queries/custom-properties";
import type {
  CustomPropertyDefinition,
  CustomPropertySelectOption,
} from "@omnipaper/database/schema";
import {
  type CustomPropertyType,
  customPropertyRegistry,
  type FromDbContext,
  type SelectOptionDto,
} from "../lib/custom-property-registry";

export function toPropertyDefinitionDto(input: {
  definition: CustomPropertyDefinition;
  options: CustomPropertySelectOption[];
}) {
  return {
    id: input.definition.id,
    key: input.definition.key,
    name: input.definition.name,
    description: input.definition.description,
    type: input.definition.type,
    options: input.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
    createdAt: input.definition.createdAt,
    updatedAt: input.definition.updatedAt,
  };
}

type DefinitionEntries = Awaited<ReturnType<typeof getOrgPropertyDefinitions>>;
type ValueRows = Awaited<ReturnType<typeof getDocumentPropertyValues>>;

export function shapeDocumentProperties(definitions: DefinitionEntries, valueRows: ValueRows) {
  const options = new Map<string, SelectOptionDto>();
  const typeById = new Map<string, CustomPropertyType>();

  for (const entry of definitions) {
    typeById.set(entry.definition.id, entry.definition.type);
    for (const option of entry.options) {
      options.set(option.id, { id: option.id, label: option.label, color: option.color });
    }
  }

  const ctx: FromDbContext = { options };
  const shaped: { definitionId: string; value: unknown }[] = [];

  for (const row of valueRows) {
    const type = typeById.get(row.definitionId);
    if (!type) {
      continue;
    }
    shaped.push({
      definitionId: row.definitionId,
      value: customPropertyRegistry[type].fromDb(row, ctx),
    });
  }

  return shaped;
}
