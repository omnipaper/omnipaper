import type { Tag } from "@omnipaper/database/schema";

export function toTagDto(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

// The compact tag shape embedded in document responses (list, detail, tag-edit) — just enough to
// render a chip. The single source for "a tag as seen from a document".
export function toTagRefDto(tag: { id: string; name: string; color: string }) {
  return { id: tag.id, name: tag.name, color: tag.color };
}
