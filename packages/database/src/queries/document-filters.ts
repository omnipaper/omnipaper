import type { FilterState, FilterValue, SortState } from "@omnipaper/shared/document-filters";
import { FILTER_NONE, parseCustomPropertyKey } from "@omnipaper/shared/document-filters";
import {
  type AnyColumn,
  and,
  asc,
  desc,
  gte,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  type customPropertyTypeEnum,
  documentCustomPropertyValues,
  documents,
  documentsTags,
} from "../schema";

type CustomPropertyType = (typeof customPropertyTypeEnum.enumValues)[number];
export type CustomPropertyTypeMap = Map<string, CustomPropertyType>;
function resolveFilter(
  key: string,
  value: FilterValue,
  cpTypes?: CustomPropertyTypeMap,
): SQL | undefined {
  const definitionId = parseCustomPropertyKey(key);
  if (definitionId !== null) {
    const type = cpTypes?.get(definitionId);
    return type ? customPropertyFilter(definitionId, type, value) : undefined;
  }
  switch (key) {
    case "documentType":
      return value.kind === "in"
        ? nullableRelationFilter(documents.documentTypeId, value.values)
        : undefined;
    case "path":
      return value.kind === "in"
        ? nullableRelationFilter(documents.storagePathId, value.values)
        : undefined;
    case "tags":
      return value.kind === "in" && value.values.length > 0 ? tagsFilter(value.values) : undefined;
    case "documentDate":
      return value.kind === "dateRange"
        ? dateRangeFilter(documents.documentDate, value)
        : undefined;
    case "createdAt":
      return value.kind === "dateRange"
        ? dateRangeFilter(documents.createdAt, value, true)
        : undefined;
    default:
      return undefined;
  }
}
function nullableRelationFilter(column: AnyColumn, values: string[]): SQL | undefined {
  const ids = values.filter((v) => v !== FILTER_NONE);
  const parts: SQL[] = [];
  if (ids.length > 0) {
    parts.push(inArray(column, ids));
  }
  if (values.includes(FILTER_NONE)) {
    parts.push(isNull(column));
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.length === 1 ? parts[0] : or(...parts);
}
function tagsFilter(tagIds: string[]): SQL {
  return sql`exists (select 1 from ${documentsTags} where ${documentsTags.documentId} = ${documents.id} and ${inArray(documentsTags.tagId, tagIds)})`;
}
function dateRangeFilter(
  column: AnyColumn,
  value: Extract<
    FilterValue,
    {
      kind: "dateRange";
    }
  >,
  isTimestamp = false,
): SQL | undefined {
  const parts: SQL[] = [];
  if (value.gte) {
    parts.push(
      isTimestamp
        ? sql`${column} >= (${value.gte}::timestamp AT TIME ZONE 'UTC')`
        : gte(column, value.gte),
    );
  }
  if (value.lte) {
    parts.push(
      isTimestamp
        ? sql`${column} < ((${value.lte}::timestamp + interval '1 day') AT TIME ZONE 'UTC')`
        : lte(column, value.lte),
    );
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.length === 1 ? parts[0] : and(...parts);
}
function customPropertyFilter(
  definitionId: string,
  type: CustomPropertyType,
  value: FilterValue,
): SQL | undefined {
  if (value.kind !== "in" || value.values.length === 0) {
    return undefined;
  }
  if (type === "select") {
    return sql`exists (select 1 from ${documentCustomPropertyValues} where ${documentCustomPropertyValues.documentId} = ${documents.id} and ${documentCustomPropertyValues.definitionId} = ${definitionId} and ${inArray(documentCustomPropertyValues.selectOptionId, value.values)})`;
  }
  if (type === "boolean") {
    const bools = value.values
      .filter((v) => v === "true" || v === "false")
      .map((v) => v === "true");
    if (bools.length === 0) {
      return undefined;
    }
    return sql`exists (select 1 from ${documentCustomPropertyValues} where ${documentCustomPropertyValues.documentId} = ${documents.id} and ${documentCustomPropertyValues.definitionId} = ${definitionId} and ${inArray(documentCustomPropertyValues.valueBool, bools)})`;
  }
  return undefined;
}
export function buildDocumentWhere(
  filters?: FilterState,
  cpTypes?: CustomPropertyTypeMap,
): (SQL | undefined)[] {
  if (!filters) {
    return [];
  }
  return Object.entries(filters).map(([key, value]) => resolveFilter(key, value, cpTypes));
}
const SORT_COLUMNS = {
  created: documents.createdAt,
  documentDate: documents.documentDate,
  title: documents.title,
  size: documents.sizeBytes,
} as const;
export function buildDocumentOrderBy(sort?: SortState): SQL[] | undefined {
  if (!sort) {
    return undefined;
  }
  const column = SORT_COLUMNS[sort.field as keyof typeof SORT_COLUMNS];
  if (!column) {
    return undefined;
  }
  // Tiebreak on id so rows keep a stable order across pages when the sort column has duplicates.
  const dir = sort.dir === "asc" ? asc : desc;
  return [dir(column), dir(documents.id)];
}
