import { recordEvent } from "@omnipaper/database/activity";
import type { Database } from "@omnipaper/database/client";
import { setSuggestionStatus } from "@omnipaper/database/queries/ai-suggestions";
import { setDocumentPropertyValue } from "@omnipaper/database/queries/custom-properties";
import { updateDocument } from "@omnipaper/database/queries/documents";
import {
  addDocumentTags,
  findOrCreateOrgTagsByName,
  getOrgTagsByIds,
} from "@omnipaper/database/queries/tags";
import type { AiSuggestion, Document } from "@omnipaper/database/schema";
import type {
  CustomPropertySuggestionValue,
  DocumentDateSuggestionValue,
  DocumentTypeSuggestionValue,
  StoragePathSuggestionValue,
  TagsSuggestionValue,
} from "@omnipaper/shared/workflows";

// Accepting a suggestion = apply its value (user-attributed) + mark it accepted. The user explicitly
// chose it, so this overwrites the field even if already set (precedence: user-set wins) and tags are
// additive. The accompanying activity event mirrors the manual-edit events so the log reads uniformly.
export async function acceptSuggestion(
  db: Database,
  params: { suggestion: AiSuggestion; document: Document; userId: string },
): Promise<void> {
  const { suggestion, document } = params;
  const organizationId = document.organizationId;
  const actor = { type: "user" as const, id: params.userId };
  const resource = { type: "document" as const, id: document.id, label: document.title };

  switch (suggestion.field) {
    case "documentType": {
      const { id } = suggestion.suggestedValue as DocumentTypeSuggestionValue;
      await updateDocument(db, { organizationId, id: document.id, documentTypeId: id });
      await recordEvent(db, {
        organizationId,
        resource,
        event: "document.metadata_updated",
        actor,
        data: { updatedFields: ["documentTypeId"] },
      });
      break;
    }
    case "storagePath": {
      const { id } = suggestion.suggestedValue as StoragePathSuggestionValue;
      await updateDocument(db, { organizationId, id: document.id, storagePathId: id });
      await recordEvent(db, {
        organizationId,
        resource,
        event: "document.metadata_updated",
        actor,
        data: { updatedFields: ["storagePathId"] },
      });
      break;
    }
    case "documentDate": {
      const { value } = suggestion.suggestedValue as DocumentDateSuggestionValue;
      await updateDocument(db, { organizationId, id: document.id, documentDate: value });
      await recordEvent(db, {
        organizationId,
        resource,
        event: "document.metadata_updated",
        actor,
        data: { updatedFields: ["documentDate"] },
      });
      break;
    }
    case "tags": {
      const value = suggestion.suggestedValue as TagsSuggestionValue;
      const existing =
        value.existingIds.length > 0
          ? await getOrgTagsByIds(db, { organizationId, ids: value.existingIds })
          : [];
      const created =
        value.newNames.length > 0
          ? await findOrCreateOrgTagsByName(db, { organizationId, names: value.newNames })
          : [];
      const added = [...existing, ...created];
      const tagIds = [...new Set(added.map((t) => t.id))];
      if (tagIds.length > 0) {
        await addDocumentTags(db, { documentId: document.id, tagIds });
        await recordEvent(db, {
          organizationId,
          resource,
          event: "document.tags_updated",
          actor,
          data: { added: added.map((t) => ({ tagId: t.id, tagName: t.name })), removed: [] },
        });
      }
      break;
    }
    case "customProperty": {
      if (suggestion.definitionId) {
        const columns = suggestion.suggestedValue as CustomPropertySuggestionValue;
        await setDocumentPropertyValue(db, {
          documentId: document.id,
          definitionId: suggestion.definitionId,
          values: columns,
        });
        await recordEvent(db, {
          organizationId,
          resource,
          event: "document.property_updated",
          actor,
          data: { updatedDefinitions: [suggestion.definitionId] },
        });
      }
      break;
    }
  }

  await setSuggestionStatus(db, { id: suggestion.id, status: "accepted" });
}
