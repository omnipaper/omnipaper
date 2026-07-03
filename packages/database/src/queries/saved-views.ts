import type { SavedViewState } from "@omnipaper/shared/saved-views";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { savedViews } from "../schema";

export async function getOrgSavedViews(db: Database, params: { organizationId: string }) {
  return db
    .select()
    .from(savedViews)
    .where(eq(savedViews.organizationId, params.organizationId))
    .orderBy(asc(savedViews.name));
}

export async function getOrgSavedView(
  db: Database,
  params: { organizationId: string; id: string },
) {
  const [view] = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, params.id), eq(savedViews.organizationId, params.organizationId)))
    .limit(1);

  return view;
}

export type CreateSavedViewInput = {
  organizationId: string;
  name: string;
  state: SavedViewState;
};

export async function createSavedView(db: Database, input: CreateSavedViewInput) {
  const [view] = await db
    .insert(savedViews)
    .values({
      organizationId: input.organizationId,
      name: input.name.trim(),
      state: input.state,
    })
    .returning();

  if (!view) {
    throw new Error("Failed to create saved view");
  }

  return view;
}

export type UpdateSavedViewInput = {
  organizationId: string;
  id: string;
  name?: string;
  state?: SavedViewState;
};

export async function updateSavedView(db: Database, input: UpdateSavedViewInput) {
  const patch: { name?: string; state?: SavedViewState } = {};

  if (input.name !== undefined) {
    patch.name = input.name.trim();
  }
  if (input.state !== undefined) {
    patch.state = input.state;
  }

  if (Object.keys(patch).length === 0) {
    return getOrgSavedView(db, { organizationId: input.organizationId, id: input.id });
  }

  const [view] = await db
    .update(savedViews)
    .set(patch)
    .where(and(eq(savedViews.id, input.id), eq(savedViews.organizationId, input.organizationId)))
    .returning();

  return view;
}

export async function deleteSavedView(
  db: Database,
  params: { organizationId: string; id: string },
) {
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, params.id), eq(savedViews.organizationId, params.organizationId)));
}
