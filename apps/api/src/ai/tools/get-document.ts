import { db } from "@omnipaper/database/client";
import {
  getDocumentPropertyValues,
  getOrgPropertyDefinitions,
} from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentType } from "@omnipaper/database/queries/document-types";
import { getOrgDocument } from "@omnipaper/database/queries/documents";
import { getOrgStoragePath } from "@omnipaper/database/queries/storage-paths";
import { getTagsByDocumentIds } from "@omnipaper/database/queries/tags";
import type { customPropertyTypeEnum, ocrStatusEnum } from "@omnipaper/database/schema";
import { tool } from "ai";
import { z } from "zod";
import { type AiToolContext, aiToolContextSchema } from "./context";

type CustomPropertyType = (typeof customPropertyTypeEnum.enumValues)[number];

type CustomPropertyEntry = {
  definition: { id: string; name: string };
  type: CustomPropertyType;
  value: { id: string; name: string } | string | number | boolean | null;
};

type DocumentDetail = {
  id: string;
  metadata: {
    title: string;
    documentType: { id: string; name: string } | null;
    storagePath: { id: string; path: string } | null;
    documentDate: string | null;
    tags: { id: string; name: string }[];
    customProperties: CustomPropertyEntry[];
  };
  file: { originalFilename: string | null; mimeType: string; sizeBytes: number };
  ocr: { status: (typeof ocrStatusEnum.enumValues)[number]; hasText: boolean };
  createdAt: string;
  updatedAt: string;
};

const inputSchema = z.object({ id: z.string().describe("Document id") });

type PropertyValueRow = Awaited<ReturnType<typeof getDocumentPropertyValues>>[number];

function resolveCustomValue(
  type: CustomPropertyType,
  row: PropertyValueRow,
  optionLabels: Map<string, string>,
): CustomPropertyEntry["value"] {
  switch (type) {
    case "select":
      return row.selectOptionId
        ? { id: row.selectOptionId, name: optionLabels.get(row.selectOptionId) ?? "(deleted)" }
        : null;
    case "number":
      return row.valueNumber;
    case "boolean":
      return row.valueBool;
    case "date":
      return row.valueDate;
    default:
      return row.valueText;
  }
}

export async function executeGetDocument(
  ctx: AiToolContext,
  rawInput: z.input<typeof inputSchema>,
): Promise<{ error: string } | DocumentDetail> {
  const input = inputSchema.parse(rawInput);
  const doc = await getOrgDocument(db, { organizationId: ctx.organizationId, id: input.id });
  if (!doc) {
    return { error: "Document not found" };
  }

  const [tags, values, documentType, storagePath] = await Promise.all([
    getTagsByDocumentIds(db, { documentIds: [doc.id] }),
    getDocumentPropertyValues(db, { documentId: doc.id }),
    doc.documentTypeId
      ? getOrgDocumentType(db, { organizationId: ctx.organizationId, id: doc.documentTypeId })
      : undefined,
    doc.storagePathId
      ? getOrgStoragePath(db, { organizationId: ctx.organizationId, id: doc.storagePathId })
      : undefined,
  ]);

  const defs =
    values.length > 0
      ? await getOrgPropertyDefinitions(db, { organizationId: ctx.organizationId })
      : [];
  const defById = new Map(
    defs.map((d) => [
      d.definition.id,
      {
        name: d.definition.name,
        type: d.definition.type,
        options: new Map(d.options.map((o) => [o.id, o.label])),
      },
    ]),
  );

  const customProperties = values
    .flatMap((row): CustomPropertyEntry[] => {
      const def = defById.get(row.definitionId);
      if (!def) {
        return [];
      }
      return [
        {
          definition: { id: row.definitionId, name: def.name },
          type: def.type,
          value: resolveCustomValue(def.type, row, def.options),
        },
      ];
    })
    .sort((a, b) => a.definition.name.localeCompare(b.definition.name));

  return {
    id: doc.id,
    metadata: {
      title: doc.title,
      documentType: documentType ? { id: documentType.id, name: documentType.name } : null,
      storagePath: storagePath ? { id: storagePath.id, path: storagePath.path } : null,
      documentDate: doc.documentDate,
      tags: tags.map((t) => ({ id: t.id, name: t.name })),
      customProperties,
    },
    file: {
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
    },
    ocr: { status: doc.ocrStatus, hasText: doc.ocrText != null && doc.ocrText.length > 0 },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const getDocumentTool = tool({
  description:
    "Current state of a document: its metadata (title, type, storage path, date, tags, custom " +
    "properties), file info, and OCR status. Use get_document_history for how it changed over time.",
  inputSchema,
  contextSchema: aiToolContextSchema,
  execute: (input, { context }) => executeGetDocument(context, input),
});
