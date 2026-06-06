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
