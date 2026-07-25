import { db } from "@omnipaper/database/client";
import {
  deleteSettingRow,
  getSettingRow,
  upsertSettingRow,
} from "@omnipaper/database/queries/settings";
import { decryptSecret, encryptSecret } from "./crypto";

export async function getSetting(key: string): Promise<string | null> {
  const row = await getSettingRow(db, { key });

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

  await upsertSettingRow(db, { key, value: stored, encrypted: secret });
}

export async function deleteSetting(key: string): Promise<void> {
  await deleteSettingRow(db, { key });
}
