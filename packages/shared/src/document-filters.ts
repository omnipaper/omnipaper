import { z } from "zod";
export const FILTER_NONE = "none";
export const filterValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("in"), values: z.array(z.string()).min(1) }),
  z.object({
    kind: z.literal("dateRange"),
    gte: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lte: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
]);
export type FilterValue = z.infer<typeof filterValueSchema>;
export const filterStateSchema = z.record(z.string(), filterValueSchema);
export type FilterState = z.infer<typeof filterStateSchema>;
export const sortStateSchema = z.object({
  field: z.string(),
  dir: z.enum(["asc", "desc"]),
});
export type SortState = z.infer<typeof sortStateSchema>;
// The built-in filter keys the db resolver (buildDocumentWhere) handles directly over real columns.
// Custom properties are keyed "cp:<definitionId>" instead. Keep this in sync with resolveFilter.
export const BUILT_IN_FILTER_KEYS = ["type", "path", "tags", "documentDate", "createdAt"] as const;
export type BuiltInFilterKey = (typeof BUILT_IN_FILTER_KEYS)[number];
const CUSTOM_PROP_PREFIX = "cp:";
export function customPropertyKey(definitionId: string): string {
  return `${CUSTOM_PROP_PREFIX}${definitionId}`;
}
export function parseCustomPropertyKey(key: string): string | null {
  return key.startsWith(CUSTOM_PROP_PREFIX) ? key.slice(CUSTOM_PROP_PREFIX.length) : null;
}
// A filter key is valid only if it's a built-in field or a well-formed custom-property key
// (cp:<non-empty id>). The API uses this to reject unknown/malformed keys with a clean 400 instead
// of silently dropping the predicate (which would widen the result set). A well-formed but stale
// cp: id still passes here and degrades gracefully at the resolver.
export function isKnownFilterKey(key: string): boolean {
  if ((BUILT_IN_FILTER_KEYS as readonly string[]).includes(key)) {
    return true;
  }
  const definitionId = parseCustomPropertyKey(key);
  return definitionId !== null && definitionId.length > 0;
}
export function encodeFilters(state: FilterState): string {
  return JSON.stringify(state);
}
export function decodeFilters(raw: string): FilterState | null {
  try {
    return filterStateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function encodeSort(sort: SortState): string {
  return `${sort.field}:${sort.dir}`;
}
export function decodeSort(raw: string): SortState | null {
  const [field, dir] = raw.split(":");
  if (!field || (dir !== "asc" && dir !== "desc")) {
    return null;
  }
  return { field, dir };
}
