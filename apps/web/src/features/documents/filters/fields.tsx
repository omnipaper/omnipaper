import { customPropertyKey, FILTER_NONE } from "@omnipaper/shared/document-filters";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  CalendarPlusIcon,
  FolderTreeIcon,
  ListIcon,
  ShapesIcon,
  TagIcon,
  ToggleLeftIcon,
} from "lucide-react";
import {
  orgPropertyDefinitionsQuery,
  type PropertyDefinition,
} from "@/features/custom-properties/queries/custom-properties";
import { orgDocumentTypesQuery } from "@/features/document-types/queries/document-types";
import { orgStoragePathsQuery } from "@/features/storage-paths/queries/storage-paths";
import { orgTagsQuery } from "@/features/tags/queries/tags";
import type { FilterFieldDef, FilterOption, SortState } from "./types";

// Two groups only: built-in fields share one unlabeled group, custom properties get their own.
export const GROUP_DEFAULT = "";
export const GROUP_CUSTOM = "Custom properties";

const BOOLEAN_OPTIONS: FilterOption[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];
function noneOption(): FilterOption {
  return { value: FILTER_NONE, label: "None" };
}
function deriveCustomPropertyFields(definitions: PropertyDefinition[]): FilterFieldDef[] {
  const fields: FilterFieldDef[] = [];
  for (const def of definitions) {
    if (def.type === "select") {
      fields.push({
        key: customPropertyKey(def.id),
        label: def.name,
        icon: ListIcon,
        group: GROUP_CUSTOM,
        picker: {
          kind: "in",
          options: def.options.map((o) => ({
            value: o.id,
            label: o.label,
            color: o.color ?? undefined,
          })),
        },
      });
    } else if (def.type === "boolean") {
      fields.push({
        key: customPropertyKey(def.id),
        label: def.name,
        icon: ToggleLeftIcon,
        group: GROUP_CUSTOM,
        picker: { kind: "in", options: BOOLEAN_OPTIONS },
      });
    }
  }
  return fields;
}
export function useDocumentFilterFields(orgId: string): FilterFieldDef[] {
  const tags = useQuery(orgTagsQuery({ orgId })).data?.tags ?? [];
  const types = useQuery(orgDocumentTypesQuery({ orgId })).data?.documentTypes ?? [];
  const paths = useQuery(orgStoragePathsQuery({ orgId })).data?.storagePaths ?? [];
  const customProps = useQuery(orgPropertyDefinitionsQuery({ orgId })).data?.definitions ?? [];
  return [
    {
      key: "documentType",
      label: "Document type",
      icon: ShapesIcon,
      group: GROUP_DEFAULT,
      picker: {
        kind: "in",
        options: [noneOption(), ...types.map((t) => ({ value: t.id, label: t.name }))],
      },
    },
    {
      key: "path",
      label: "Storage path",
      icon: FolderTreeIcon,
      group: GROUP_DEFAULT,
      picker: {
        kind: "in",
        options: [noneOption(), ...paths.map((p) => ({ value: p.id, label: p.path }))],
      },
    },
    {
      key: "tags",
      label: "Tags",
      icon: TagIcon,
      group: GROUP_DEFAULT,
      picker: {
        kind: "in",
        options: tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
      },
    },
    {
      key: "documentDate",
      label: "Document date",
      icon: CalendarIcon,
      group: GROUP_DEFAULT,
      picker: { kind: "dateRange" },
    },
    {
      key: "createdAt",
      label: "Added",
      icon: CalendarPlusIcon,
      group: GROUP_DEFAULT,
      picker: { kind: "dateRange" },
    },
    ...deriveCustomPropertyFields(customProps),
  ];
}
// Ordering: the Display panel's Select picks the field, a toggle next to it picks the direction.
// Default = Added (createdAt) descending — also getDocuments' default order, so the URL stays clean
// until the user changes it.
export const ORDERING_FIELDS = [
  { field: "documentDate", label: "Document date" },
  { field: "created", label: "Added" },
  { field: "title", label: "Title" },
] as const;
export const DEFAULT_ORDER: SortState = { field: "created", dir: "desc" };
