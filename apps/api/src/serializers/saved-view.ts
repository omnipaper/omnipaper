import type { SavedView } from "@omnipaper/database/schema";

export function toSavedViewDto(view: SavedView) {
  return {
    id: view.id,
    name: view.name,
    state: view.state,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}
