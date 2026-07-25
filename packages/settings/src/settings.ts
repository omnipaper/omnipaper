import { db } from "@omnipaper/database/client";
import {
  deleteSettingRow,
  getSettingRow,
  upsertSettingRow,
} from "@omnipaper/database/queries/settings";
import { decryptSecret, encryptSecret } from "./crypto";

// TODO: TTL is useful for separate instances. In production scale the cache should in redis
const TTL_MS = 30_000;

type Entry = { value: string | null; at: number };

const cache = new Map<string, Entry>();

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.value;
  }

  const row = await getSettingRow(db, { key });
  // Absent keys are cached too: engine-dependent fields like region/endpoint are legitimately unset,
  // and without this they would miss on every read.
  const value = row ? (row.encrypted ? decryptSecret(row.value) : row.value) : null;

  cache.set(key, { value, at: Date.now() });

  return value;
}

export async function setSetting(args: {
  key: string;
  value: string;
  secret?: boolean;
}): Promise<void> {
  const { key, value, secret = false } = args;
  const stored = secret ? encryptSecret(value) : value;

  await upsertSettingRow(db, { key, value: stored, encrypted: secret });
  cache.delete(key);
}

export async function deleteSetting(key: string): Promise<void> {
  await deleteSettingRow(db, { key });
  cache.delete(key);
}
