import { db } from "@omnipaper/database/client";
import { settings } from "@omnipaper/database/schema";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./crypto";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  return row.encrypted ? decryptSecret(row.value) : row.value;
}

export async function setSetting(args: {
  key: string;
  value: string;
  secret?: boolean;
}): Promise<void> {
  const { key, value, secret = false } = args;
  const stored = secret ? encryptSecret(value) : value;

  await db
    .insert(settings)
    .values({ key, value: stored, encrypted: secret })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: stored, encrypted: secret },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
