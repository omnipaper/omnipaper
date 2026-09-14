import { db } from "@omnipaper/database/client";
import { getDocumentFieldChanges } from "@omnipaper/database/field-changes";
import { getDocumentSuggestions } from "@omnipaper/database/queries/ai-suggestions";
import { getOrgPropertyDefinitions } from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentTypes } from "@omnipaper/database/queries/document-types";
import { getOrgDocument } from "@omnipaper/database/queries/documents";
import { getOrgStoragePaths } from "@omnipaper/database/queries/storage-paths";
import { getOrgTags } from "@omnipaper/database/queries/tags";
import { aiSuggestionFieldEnum } from "@omnipaper/database/schema";
import { tool } from "ai";
import { z } from "zod";
import { type AiToolContext, aiToolContextSchema } from "../context";
import {
  definitionRef,
  type EntityRef,
  type HistoryEntry,
  type HistoryLookups,
  toSuggestionEntries,
} from "./history-entries";

const inputSchema = z.object({
  id: z.string().describe("Document id"),
  field: z
    .enum(aiSuggestionFieldEnum.enumValues)
    .optional()
    .describe("Restrict to one field, e.g. tags"),
  limit: z.number().int().min(1).max(200).default(50).describe("Max entries"),
});

// Typed with the schema's input side so direct callers (dev script, tests) may omit defaulted
// fields; the parse below fills them in for every caller, not only the AI SDK path.
export async function executeGetDocumentHistory(
  ctx: AiToolContext,
  rawInput: z.input<typeof inputSchema>,
): Promise<{ error: string } | { document: EntityRef; entries: HistoryEntry[] }> {
  const input = inputSchema.parse(rawInput);
  const doc = await getOrgDocument(db, { organizationId: ctx.organizationId, id: input.id });
  if (!doc) {
    return { error: "Document not found" };
  }

  const [changes, suggestions] = await Promise.all([
    getDocumentFieldChanges(db, {
      documentId: doc.id,
      field: input.field,
      limit: input.limit,
    }),
    getDocumentSuggestions(db, { documentId: doc.id, field: input.field }),
  ]);

  const open = suggestions.filter((s) => s.status !== "accepted");
  const suggestionFields = new Set(open.map((s) => s.field));
  const needsDefinitions =
    changes.some((c) => c.customPropertyDefinitionId) ||
    open.some((s) => s.customPropertyDefinitionId);

  const [types, paths, tags, defs] = await Promise.all([
    suggestionFields.has("documentType")
      ? getOrgDocumentTypes(db, { organizationId: ctx.organizationId })
      : [],
    suggestionFields.has("storagePath")
      ? getOrgStoragePaths(db, { organizationId: ctx.organizationId })
      : [],
    suggestionFields.has("tags") ? getOrgTags(db, { organizationId: ctx.organizationId }) : [],
    needsDefinitions ? getOrgPropertyDefinitions(db, { organizationId: ctx.organizationId }) : [],
  ]);

  const lookups: HistoryLookups = {
    documentTypes: new Map(types.map((t) => [t.id, t.name])),
    storagePaths: new Map(paths.map((p) => [p.id, p.path])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
    definitions: new Map(
      defs.map((d) => [
        d.definition.id,
        { name: d.definition.name, options: new Map(d.options.map((o) => [o.id, o.label])) },
      ]),
    ),
  };

  const entries: HistoryEntry[] = [
    ...changes.map(
      (row): HistoryEntry => ({
        kind: "change",
        at: row.createdAt.toISOString(),
        field: row.field,
        definition: definitionRef(row.customPropertyDefinitionId, lookups),
        old: row.oldValue,
        new: row.newValue,
        source: row.source,
        ...(row.createdByName ? { by: row.createdByName } : {}),
      }),
    ),
    ...open.flatMap((row) => toSuggestionEntries(row, lookups)),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, input.limit);

  return { document: { id: doc.id, name: doc.title }, entries };
}

export const getDocumentHistoryTool = tool({
  description:
    "Full metadata history of a document: applied field changes (old → new, who, when) and AI " +
    "suggestions with their fate (pending or dismissed). Newest first.",
  inputSchema,
  contextSchema: aiToolContextSchema,
  execute: (input, { context }) => executeGetDocumentHistory(context, input),
});
