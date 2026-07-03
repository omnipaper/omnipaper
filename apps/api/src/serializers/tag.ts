import type { Tag } from "@omnipaper/database/schema";

export function toTagDto(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    description: tag.description,
    aiEligible: tag.aiEligible,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

export function toTagRefDto(tag: { id: string; name: string; color: string }) {
  return { id: tag.id, name: tag.name, color: tag.color };
}
