import { zValidator } from "@hono/zod-validator";
import { createMistralOcr } from "@omnipaper/ocr/mistral";
import {
  getOcrSettings,
  ocrSettingsSchema,
  setOcrSettings,
} from "@omnipaper/settings/ocr-settings";
import { SECRET_MASK, unmaskSecret } from "@omnipaper/settings/secret";
import {
  getStorageSettings,
  setStorageSettings,
  storageSettingsSchema,
} from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";
import { Hono } from "hono";
import type { Variables } from "../context";
import { requireAdmin } from "../middleware";

export const settingsRoutes = new Hono<{ Variables: Variables }>()
  .get("/storage", requireAdmin, async (c) => {
    const stored = await getStorageSettings();

    return c.json({
      configured: stored !== null,
      bucket: stored?.bucket ?? null,
      region: stored?.region ?? null,
      endpoint: stored?.endpoint ?? null,
      accessKeyId: stored ? SECRET_MASK : null,
      secretAccessKey: stored ? SECRET_MASK : null,
    });
  })
  .put("/storage", requireAdmin, zValidator("json", storageSettingsSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getStorageSettings();

    // A secret left as SECRET_MASK means the admin didn't change it → keep the stored value.
    await setStorageSettings({
      ...incoming,
      accessKeyId: unmaskSecret(incoming.accessKeyId, stored?.accessKeyId),
      secretAccessKey: unmaskSecret(incoming.secretAccessKey, stored?.secretAccessKey),
    });

    return c.json({ ok: true });
  })
  .post("/storage/test", requireAdmin, zValidator("json", storageSettingsSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getStorageSettings();

    const driver = createS3Driver({
      ...incoming,
      accessKeyId: unmaskSecret(incoming.accessKeyId, stored?.accessKeyId),
      secretAccessKey: unmaskSecret(incoming.secretAccessKey, stored?.secretAccessKey),
    });

    try {
      await driver.testConnection();
      return c.json({ ok: true, error: null });
    } catch (error) {
      return c.json({
        ok: false,
        error: error instanceof Error ? error.message : "Connection failed",
      });
    }
  })
  .get("/ocr", requireAdmin, async (c) => {
    const stored = await getOcrSettings();

    return c.json({
      configured: stored !== null,
      provider: stored?.provider ?? "mistral",
      apiKey: stored ? SECRET_MASK : null,
    });
  })
  .put("/ocr", requireAdmin, zValidator("json", ocrSettingsSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getOcrSettings();

    await setOcrSettings({
      ...incoming,
      apiKey: unmaskSecret(incoming.apiKey, stored?.apiKey),
    });

    return c.json({ ok: true });
  })
  .post("/ocr/test", requireAdmin, zValidator("json", ocrSettingsSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getOcrSettings();

    const ocr = createMistralOcr({ apiKey: unmaskSecret(incoming.apiKey, stored?.apiKey) });

    try {
      await ocr.testConnection();
      return c.json({ ok: true, error: null });
    } catch (error) {
      return c.json({
        ok: false,
        error: error instanceof Error ? error.message : "Connection failed",
      });
    }
  });
