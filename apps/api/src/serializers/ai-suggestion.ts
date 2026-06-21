import type { AiSuggestion } from "@omnipaper/database/schema";
import type {
  CustomPropertySuggestionValue,
  DocumentDateSuggestionValue,
  DocumentTypeSuggestionValue,
  StoragePathSuggestionValue,
  TagsSuggestionValue,
} from "@omnipaper/shared/workflows";
import {
  type CustomPropertyType,
  customPropertyRegistry,
  type FromDbContext,
  type SelectOptionDto,
} from "../custom-properties/registry";

// Turns stored suggestion rows into chip DTOs for the document view. Ids in `suggestedValue` are
// resolved to display labels here; if a referenced type/path/tag/definition has since been deleted
// the suggestion is dropped (skipped), so a stale chip never renders.

export type AiSuggestionDto = {
  id: string;
  field: AiSuggestion["field"];
  definitionId: string | null;
  label: string;
  confidence: number | null;
  model: string | null;
};

export type SuggestionResolution = {
  documentTypes: { id: string; name: string }[];
  storagePaths: { id: string; path: string }[];
  tags: { id: string; name: string }[];
  definitions: { id: string; name: string; type: CustomPropertyType; options: SelectOptionDto[] }[];
};

export function serializeSuggestions(
  suggestions: AiSuggestion[],
  resolution: SuggestionResolution,
): AiSuggestionDto[] {
  const typeName = new Map(resolution.documentTypes.map((t) => [t.id, t.name]));
  const pathName = new Map(resolution.storagePaths.map((p) => [p.id, p.path]));
  const tagName = new Map(resolution.tags.map((t) => [t.id, t.name]));
  const definitionById = new Map(resolution.definitions.map((d) => [d.id, d]));
  const optionById = new Map<string, SelectOptionDto>();
  for (const definition of resolution.definitions) {
    for (const option of definition.options) {
      optionById.set(option.id, option);
    }
  }
  const fromDbContext: FromDbContext = { options: optionById };

  const dtos: AiSuggestionDto[] = [];

  for (const suggestion of suggestions) {
    const label = resolveLabel(suggestion);
    if (label === null) {
      continue;
    }
    dtos.push({
      id: suggestion.id,
      field: suggestion.field,
      definitionId: suggestion.definitionId,
      label,
      confidence: suggestion.confidence,
      model: suggestion.model,
    });
  }

  return dtos;

  function resolveLabel(suggestion: AiSuggestion): string | null {
    switch (suggestion.field) {
      case "documentType":
        return typeName.get((suggestion.suggestedValue as DocumentTypeSuggestionValue).id) ?? null;
      case "storagePath":
        return pathName.get((suggestion.suggestedValue as StoragePathSuggestionValue).id) ?? null;
      case "documentDate":
        return (suggestion.suggestedValue as DocumentDateSuggestionValue).value;
      case "tags": {
        const value = suggestion.suggestedValue as TagsSuggestionValue;
        const names = value.existingIds.map((id) => tagName.get(id)).filter(isString);
        const fresh = value.newNames.map((name) => `${name} (new)`);
        const all = [...names, ...fresh];
        return all.length > 0 ? all.join(", ") : null;
      }
      case "customProperty": {
        if (!suggestion.definitionId) {
          return null;
        }
        const definition = definitionById.get(suggestion.definitionId);
        if (!definition) {
          return null;
        }
        const columns = suggestion.suggestedValue as CustomPropertySuggestionValue;
        const rendered = customPropertyRegistry[definition.type].fromDb(columns, fromDbContext);
        const display = renderValue(rendered);
        return display === null ? null : `${definition.name}: ${display}`;
      }
    }
  }
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

// fromDb returns a primitive for most types and a {label} option object for select.
function renderValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && "label" in value) {
    return String((value as { label: unknown }).label);
  }
  return String(value);
}
