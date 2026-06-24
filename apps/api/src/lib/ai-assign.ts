import { classifyDocument } from "@omnipaper/ai/classify";
import { recordEvent } from "@omnipaper/database/activity";
import { db } from "@omnipaper/database/client";
import { upsertAiSuggestion } from "@omnipaper/database/queries/ai-suggestions";
import { getOrgDocumentTypes } from "@omnipaper/database/queries/document-types";
import { updateDocument } from "@omnipaper/database/queries/documents";
import { getOrgStoragePaths } from "@omnipaper/database/queries/storage-paths";
import { addDocumentTag, createTag, getOrgTags } from "@omnipaper/database/queries/tags";
import { getAiSettings } from "@omnipaper/settings/ai-settings";
import { getProviderKeys } from "@omnipaper/settings/provider-settings";
import { resolveAiModel } from "@omnipaper/shared/ai-models";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";

type Doc = {
  id: string;
  organizationId: string;
  title: string;
  ocrText: string | null;
  documentTypeId: string | null;
  storagePathId: string | null;
};

// Resolves the AI's flat name-based output back to org ids and applies it (approach B): auto writes
// straight to the document, suggest stages an ai_suggestions row. Auto never clobbers a value the
// user already set (type/path). Phase 1 fields only (documentType / storagePath / tags / title);
// documentDate + customFields land in phase 2.
export async function runAiAssignMetadata(
  doc: Doc,
  config: AiAssignParams,
): Promise<{ ok: boolean; detail?: string }> {
  if (!doc.ocrText) {
    return { ok: false, detail: "document has no extracted text" };
  }

  const ai = await getAiSettings();
  const apiKey = (await getProviderKeys())[ai.provider];
  if (!apiKey) {
    return { ok: false, detail: `missing ${ai.provider} API key` };
  }

  const [types, paths, tags] = await Promise.all([
    getOrgDocumentTypes(db, { organizationId: doc.organizationId }),
    getOrgStoragePaths(db, { organizationId: doc.organizationId }),
    getOrgTags(db, { organizationId: doc.organizationId }),
  ]);

  const result = await classifyDocument({
    provider: ai.provider,
    model: resolveAiModel(ai.provider, ai.model),
    apiKey,
    fields: config,
    ocrText: doc.ocrText,
    candidates: {
      documentTypes: types.map((t) => ({ name: t.name, description: t.description })),
      storagePaths: paths.map((p) => ({ path: p.path, description: p.description })),
      tags: tags.map((t) => ({ name: t.name })),
    },
  });

  const updatedFields: string[] = [];
  let tagsChanged = false;

  if (config.documentType && result.documentType) {
    const match = types.find((t) => t.name === result.documentType);
    if (match) {
      if (config.documentType.mode === "auto") {
        if (!doc.documentTypeId) {
          await updateDocument(db, {
            organizationId: doc.organizationId,
            id: doc.id,
            documentTypeId: match.id,
          });
          updatedFields.push("documentType");
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
    const match = paths.find((p) => p.path === result.storagePath);
    if (match) {
      if (config.storagePath.mode === "auto") {
        if (!doc.storagePathId) {
          await updateDocument(db, {
            organizationId: doc.organizationId,
            id: doc.id,
            storagePathId: match.id,
          });
          updatedFields.push("storagePath");
        }
      } else {
        await upsertAiSuggestion(db, {
          documentId: doc.id,
          field: "storagePath",
          suggestedValue: { id: match.id },
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

    if (config.tags.mode === "auto") {
      for (const id of existingIds) {
        await addDocumentTag(db, { documentId: doc.id, tagId: id });
        tagsChanged = true;
      }
      if (config.tags.allowNew) {
        for (const name of newNames) {
          const tag = await createTag(db, { organizationId: doc.organizationId, name });
          await addDocumentTag(db, { documentId: doc.id, tagId: tag.id });
          tagsChanged = true;
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
    if (config.title.mode === "auto") {
      await updateDocument(db, {
        organizationId: doc.organizationId,
        id: doc.id,
        title: result.title,
      });
      updatedFields.push("title");
    } else {
      await upsertAiSuggestion(db, {
        documentId: doc.id,
        field: "title",
        suggestedValue: { value: result.title },
      });
    }
  }

  if (updatedFields.length > 0) {
    await recordEvent(db, {
      organizationId: doc.organizationId,
      resource: { type: "document", id: doc.id, label: doc.title },
      event: "document.metadata_updated",
      actor: { type: "system" },
      data: { updatedFields },
    });
  }
  if (tagsChanged) {
    await recordEvent(db, {
      organizationId: doc.organizationId,
      resource: { type: "document", id: doc.id, label: doc.title },
      event: "document.tags_updated",
      actor: { type: "system" },
      data: { source: "ai" },
    });
  }

  return { ok: true };
}
