import type { Database } from "@omnipaper/database/client";
import { getOrgPropertyDefinitions } from "@omnipaper/database/queries/custom-properties";
import { getOrgDocumentTypes } from "@omnipaper/database/queries/document-types";
import { getOrgStoragePaths } from "@omnipaper/database/queries/storage-paths";
import { getOrgTags } from "@omnipaper/database/queries/tags";
import type { AiAssignFields } from "@omnipaper/shared/workflows";
import type { CustomPropertyType } from "../../custom-properties/registry";

// The org's existing options the classifier must choose from — the closed sets behind the response
// schema's enums and the prompt's "available X" lists. We only load what the enabled fields need, so
// a tags-only action never queries document types.

export type CandidateDocumentType = { id: string; name: string; description: string | null };
export type CandidateStoragePath = { id: string; path: string; description: string | null };
export type CandidateTag = { id: string; name: string };
export type CandidateCustomField = {
  id: string;
  name: string;
  description: string | null;
  type: CustomPropertyType;
  options: { id: string; label: string }[];
};

export type AiCandidates = {
  documentTypes: CandidateDocumentType[];
  storagePaths: CandidateStoragePath[];
  tags: CandidateTag[];
  customFields: CandidateCustomField[];
};

export async function loadAiCandidates(
  db: Database,
  params: { organizationId: string; fields: AiAssignFields },
): Promise<AiCandidates> {
  const { organizationId, fields } = params;

  const [types, paths, tags, definitions] = await Promise.all([
    fields.documentType ? getOrgDocumentTypes(db, { organizationId }) : Promise.resolve([]),
    fields.storagePath ? getOrgStoragePaths(db, { organizationId }) : Promise.resolve([]),
    fields.tags ? getOrgTags(db, { organizationId }) : Promise.resolve([]),
    fields.customFields ? getOrgPropertyDefinitions(db, { organizationId }) : Promise.resolve([]),
  ]);

  const requested = new Set(fields.customFields?.definitionIds ?? []);

  return {
    documentTypes: types.map((t) => ({ id: t.id, name: t.name, description: t.description })),
    storagePaths: paths.map((p) => ({ id: p.id, path: p.path, description: p.description })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
    customFields: definitions
      .filter((entry) => requested.has(entry.definition.id))
      .map((entry) => ({
        id: entry.definition.id,
        name: entry.definition.name,
        description: entry.definition.description,
        type: entry.definition.type,
        options: entry.options.map((o) => ({ id: o.id, label: o.label })),
      })),
  };
}
