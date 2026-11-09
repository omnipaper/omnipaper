import {
  BUNDLED_MODEL_MANIFEST,
  MODEL_MANIFEST_URL,
  type ModelManifest,
  manifestUpdatedAtMs,
  modelManifestSchema,
} from "@omnipaper/ai/model-manifest";
import { z } from "zod";
import { getSetting, setSetting } from "./settings";

const TTL_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

const KEYS = {
  cache: "ai.modelManifest",
  remoteUpdates: "ai.modelManifestRemoteUpdates",
} as const;

const cacheSchema = z.object({ fetchedAt: z.number(), manifest: modelManifestSchema });

let manifest: ModelManifest = BUNDLED_MODEL_MANIFEST;
let fetchedAt: number | null = null;
let lastAttemptAt: number | null = null;
let cacheLoaded: Promise<void> | null = null;
let refreshing: Promise<void> | null = null;

export async function getModelManifestRemoteUpdates(): Promise<boolean> {
  return (await getSetting(KEYS.remoteUpdates)) !== "false";
}

export async function setModelManifestRemoteUpdates(value: boolean): Promise<void> {
  await setSetting({ key: KEYS.remoteUpdates, value: value ? "true" : "false" });
}

// The KV copy survives container restarts, so a restart while the remote is down doesn't fall
// back to the older bundled list. A newer bundle (a release) still wins over an older cache.
async function loadCache(): Promise<void> {
  const raw = await getSetting(KEYS.cache);
  if (!raw) {
    return;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }
  const parsed = cacheSchema.safeParse(json);
  if (!parsed.success) {
    return;
  }
  if (manifestUpdatedAtMs(parsed.data.manifest) < manifestUpdatedAtMs(manifest)) {
    return;
  }
  manifest = parsed.data.manifest;
  fetchedAt = parsed.data.fetchedAt;
}

// Clock rollback: a timestamp in the future counts as expired.
function isWithin(since: number | null, windowMs: number, now: number): boolean {
  return since !== null && now >= since && now - since < windowMs;
}

async function refresh(): Promise<void> {
  const now = Date.now();
  if (isWithin(fetchedAt, TTL_MS, now) || isWithin(lastAttemptAt, RETRY_MS, now)) {
    return;
  }
  if (!(await getModelManifestRemoteUpdates())) {
    return;
  }
  lastAttemptAt = now;

  let json: unknown;
  try {
    const res = await fetch(MODEL_MANIFEST_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      return;
    }
    json = await res.json();
  } catch {
    return;
  }

  // Unknown `version` fails here, so a format bump never reaches releases that can't read it.
  const parsed = modelManifestSchema.safeParse(json);
  if (!parsed.success || manifestUpdatedAtMs(parsed.data) < manifestUpdatedAtMs(manifest)) {
    return;
  }

  manifest = parsed.data;
  fetchedAt = now;
  await setSetting({ key: KEYS.cache, value: JSON.stringify({ fetchedAt: now, manifest }) });
}

// Never waits on the network: returns what's loaded now and refreshes in the background.
export async function getModelManifest(): Promise<ModelManifest> {
  cacheLoaded ??= loadCache().catch(() => {});
  await cacheLoaded;

  if (!refreshing) {
    refreshing = refresh()
      .catch(() => {})
      .finally(() => {
        refreshing = null;
      });
  }

  return manifest;
}
