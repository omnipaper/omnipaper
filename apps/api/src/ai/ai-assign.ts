import { classifyDocument } from "@omnipaper/ai/classify";
import { db } from "@omnipaper/database/client";
import {
  type FieldChangeInput,
  getLatestFieldSources,
  recordFieldChanges,
} from "@omnipaper/database/field-changes";
import { upsertAiSuggestion } from "@omnipaper/database/queries/ai-suggestions";
import {
  addPropertyOption,
  getDocumentPropertyValues,
  getOrgPropertyDefinitions,
  setDocumentPropertyValue,
} from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentTypes } from "@omnipaper/database/queries/document-types";
import { updateDocument } from "@omnipaper/database/queries/documents";
import { createStoragePath, getOrgStoragePaths } from "@omnipaper/database/queries/storage-paths";
import {
  addDocumentTag,
  createTag,
  getOrgTags,
  getTagsByDocumentIds,
} from "@omnipaper/database/queries/tags";
import { getAiRuntimeConfig } from "@omnipaper/settings/ai-settings";
import type { FieldSource } from "@omnipaper/shared/field-changes";
import { isValidStoragePath, normalizeStoragePath } from "@omnipaper/shared/storage-paths";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import {
  coerceCustomValue,
  customPropertyRegistry,
  propertyChangeSnapshot,
} from "../lib/custom-property-registry";

type Doc = {
  id: string;
  organizationId: string;
  title: string;
  ocrText: string | null;
  documentTypeId: string | null;
  storagePathId: string | null;
  documentDate: string | null;
};

// AI may overwrite only empty or AI-set fields; no journal row counts as human-set.
// Title is never empty (ingest sets it), so AI may replace it unless a human edited it.
function aiMayWrite(currentValue: unknown, source: FieldSource | undefined): boolean {
  return !currentValue || source === "ai";
}

export async function runAiAssignMetadata(
  doc: Doc,
  config: AiAssignParams,
): Promise<{ ok: boolean; detail?: string }> {
  if (!doc.ocrText) {
    return { ok: false, detail: "document has no extracted text" };
  }

  const runtime = await getAiRuntimeConfig();
  if (!runtime.ok) {
    return { ok: false, detail: runtime.detail };
  }

  const customEntries = new Map((config.customFields ?? []).map((e) => [e.definitionId, e]));
  const [types, paths, tags] = await Promise.all([
    getOrgDocumentTypes(db, { organizationId: doc.organizationId }),
    getOrgStoragePaths(db, { organizationId: doc.organizationId }),
    getOrgTags(db, { organizationId: doc.organizationId }),
  ]);
  const customDefs =
    customEntries.size > 0
      ? (await getOrgPropertyDefinitions(db, { organizationId: doc.organizationId })).filter((d) =>
          customEntries.has(d.definition.id),
        )
      : [];

  const eligibleTypes = types.filter((t) => t.aiEligible);
  const eligiblePaths = paths.filter((p) => p.aiEligible);
  const eligibleTags = tags.filter((t) => t.aiEligible);
  const reservedTagNames = tags.filter((t) => !t.aiEligible).map((t) => t.name);

  const result = await classifyDocument({
    ...runtime.config,
    fields: config,
    ocrText: doc.ocrText,
    reservedTagNames,
    candidates: {
      documentTypes: eligibleTypes.map((t) => ({ name: t.name, description: t.description })),
      storagePaths: eligiblePaths.map((p) => ({ path: p.path, description: p.description })),
      tags: eligibleTags.map((t) => ({ name: t.name })),
      customFields: customDefs.map((d) => ({
        name: d.definition.name,
        type: d.definition.type,
        description: d.definition.description,
        options: d.definition.type === "select" ? d.options.map((o) => o.label) : [],
        allowNew:
          d.definition.type === "select" && (customEntries.get(d.definition.id)?.allowNew ?? false),
      })),
    },
  });

  const sourceByField = new Map(
    (await getLatestFieldSources(db, { documentId: doc.id }))
      .filter((row) => row.customPropertyDefinitionId === null)
      .map((row) => [row.field, row.source] as const),
  );
  const changes: FieldChangeInput[] = [];

  if (config.documentType && result.documentType) {
    const match = types.find((t) => t.name === result.documentType);
    if (match) {
      if (config.documentType.mode === "apply") {
        if (
          aiMayWrite(doc.documentTypeId, sourceByField.get("documentType")) &&
          doc.documentTypeId !== match.id
        ) {
          const prev = types.find((t) => t.id === doc.documentTypeId);
          await updateDocument(db, {
            organizationId: doc.organizationId,
            id: doc.id,
            documentTypeId: match.id,
          });
          changes.push({
            field: "documentType",
            oldValue: prev ? { id: prev.id, name: prev.name } : null,
            newValue: { id: match.id, name: match.name },
          });
        }
      } else {
        await upsertAiSuggestion(db, {
          documentId: doc.id,
          field: "documentType",
          suggestedValue: { id: match.id },
        });
      }
    }
  }

  if (config.storagePath && result.storagePath) {
    const wanted = normalizeStoragePath(result.storagePath);
    const match = paths.find((p) => p.path === wanted);
    // A model-proposed path is only usable when allowNew is on and it passes the path rules.
    const canCreate = !match && config.storagePath.allowNew && isValidStoragePath(wanted);
    if (match || canCreate) {
      if (config.storagePath.mode === "apply") {
        if (aiMayWrite(doc.storagePathId, sourceByField.get("storagePath"))) {
          const next =
            match ??
            (await createStoragePath(db, {
              organizationId: doc.organizationId,
              path: wanted,
              aiEligible: true,
            }));
          if (doc.storagePathId !== next.id) {
            const prev = paths.find((p) => p.id === doc.storagePathId);
            await updateDocument(db, {
              organizationId: doc.organizationId,
              id: doc.id,
              storagePathId: next.id,
            });
            changes.push({
              field: "storagePath",
              oldValue: prev ? { id: prev.id, name: prev.path } : null,
              newValue: { id: next.id, name: next.path },
            });
          }
        }
      } else {
        await upsertAiSuggestion(db, {
          documentId: doc.id,
          field: "storagePath",
          suggestedValue: match ? { id: match.id } : { value: wanted },
        });
      }
    }
  }

  if (config.tags && result.tags && result.tags.length > 0) {
    const byName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id] as const));
    const existingIds: string[] = [];
    const newNames: string[] = [];
    for (const name of result.tags) {
      const id = byName.get(name.toLowerCase());
      if (id) {
        existingIds.push(id);
      } else {
        newNames.push(name);
      }
    }

    if (config.tags.mode === "apply") {
      const currentTagIds = new Set(
        (await getTagsByDocumentIds(db, { documentIds: [doc.id] })).map((t) => t.id),
      );
      const tagById = new Map(tags.map((t) => [t.id, t] as const));
      for (const id of existingIds) {
        await addDocumentTag(db, { documentId: doc.id, tagId: id });
        if (!currentTagIds.has(id)) {
          const tag = tagById.get(id);
          changes.push({ field: "tags", newValue: { id, name: tag?.name ?? "" } });
        }
      }
      if (config.tags.allowNew) {
        for (const name of newNames) {
          const tag = await createTag(db, { organizationId: doc.organizationId, name });
          await addDocumentTag(db, { documentId: doc.id, tagId: tag.id });
          changes.push({ field: "tags", newValue: { id: tag.id, name: tag.name } });
        }
      }
    } else {
      await upsertAiSuggestion(db, {
        documentId: doc.id,
        field: "tags",
        suggestedValue: { existingIds, newNames: config.tags.allowNew ? newNames : [] },
      });
    }
  }

  if (config.title && result.title) {
    if (config.title.mode === "apply") {
      if (sourceByField.get("title") !== "human" && doc.title !== result.title) {
        await updateDocument(db, {
          organizationId: doc.organizationId,
          id: doc.id,
          title: result.title,
        });
        changes.push({
          field: "title",
          oldValue: { value: doc.title },
          newValue: { value: result.title },
        });
      }
    } else {
      await upsertAiSuggestion(db, {
        documentId: doc.id,
        field: "title",
        suggestedValue: { value: result.title },
      });
    }
  }

  if (config.documentDate && result.documentDate) {
    if (config.documentDate.mode === "apply") {
      if (
        aiMayWrite(doc.documentDate, sourceByField.get("documentDate")) &&
        doc.documentDate !== result.documentDate
      ) {
        await updateDocument(db, {
          organizationId: doc.organizationId,
          id: doc.id,
          documentDate: result.documentDate,
        });
        changes.push({
          field: "documentDate",
          oldValue: doc.documentDate ? { value: doc.documentDate } : null,
          newValue: { value: result.documentDate },
        });
      }
    } else {
      await upsertAiSuggestion(db, {
        documentId: doc.id,
        field: "documentDate",
        suggestedValue: { value: result.documentDate },
      });
    }
  }

  if (customEntries.size > 0 && result.customFields) {
    const byName = new Map(customDefs.map((d) => [d.definition.name, d] as const));
    const propertyRows = await getDocumentPropertyValues(db, { documentId: doc.id });
    for (const entry of result.customFields) {
      const def = byName.get(entry.field);
      const cfg = def ? customEntries.get(def.definition.id) : undefined;
      const value = entry.value?.trim();
      if (!def || !cfg || !value) {
        continue;
      }
      const allowNew = def.definition.type === "select" && (cfg.allowNew ?? false);
      if (cfg.mode === "apply") {
        let createdOption: { id: string; label: string } | null = null;
        let columns = coerceCustomValue(def.definition.type, def.options, value);
        if (!columns && allowNew) {
          createdOption = await addPropertyOption(db, {
            definitionId: def.definition.id,
            label: value,
          });
          columns = customPropertyRegistry.select.toDb(createdOption.id);
        }
        if (columns) {
          const options = createdOption ? [...def.options, createdOption] : def.options;
          const prevRow = propertyRows.find((row) => row.definitionId === def.definition.id);
          await setDocumentPropertyValue(db, {
            documentId: doc.id,
            definitionId: def.definition.id,
            values: columns,
          });
          changes.push({
            field: "customProperty",
            customPropertyDefinitionId: def.definition.id,
            oldValue: propertyChangeSnapshot(def.definition.type, options, prevRow),
            newValue: propertyChangeSnapshot(def.definition.type, options, columns),
          });
        }
      } else if (def.definition.type === "select") {
        const option = def.options.find((o) => o.label.toLowerCase() === value.toLowerCase());
        if (option) {
          await upsertAiSuggestion(db, {
            documentId: doc.id,
            field: "customProperty",
            customPropertyDefinitionId: def.definition.id,
            suggestedValue: { selectOptionId: option.id },
          });
        } else if (allowNew) {
          await upsertAiSuggestion(db, {
            documentId: doc.id,
            field: "customProperty",
            customPropertyDefinitionId: def.definition.id,
            suggestedValue: { newOptionLabel: value },
          });
        }
      } else {
        await upsertAiSuggestion(db, {
          documentId: doc.id,
          field: "customProperty",
          customPropertyDefinitionId: def.definition.id,
          suggestedValue: { value },
        });
      }
    }
  }

  if (changes.length > 0) {
    await recordFieldChanges(db, { documentId: doc.id, source: "ai", changes });
  }

  return { ok: true };
}
