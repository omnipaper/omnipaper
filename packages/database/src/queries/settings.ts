import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { settings } from "../schema";

export type SettingRowParams = {
  key: string;
};

export type UpsertSettingRowInput = {
  key: string;
  value: string;
  encrypted: boolean;
};

export async function getSettingRow(db: Database, params: SettingRowParams) {
  const [row] = await db.select().from(settings).where(eq(settings.key, params.key)).limit(1);

  return row ?? null;
}

export async function upsertSettingRow(db: Database, input: UpsertSettingRowInput) {
  await db
    .insert(settings)
    .values(input)
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: input.value, encrypted: input.encrypted },
    });
}

export async function deleteSettingRow(db: Database, params: SettingRowParams) {
  await db.delete(settings).where(eq(settings.key, params.key));
}
