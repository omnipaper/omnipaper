import { zValidator } from "@hono/zod-validator";
import { getOcrDefinition, listOcrDefinitions, resolveModel } from "@omnipaper/ocr/resolve";
import { testProviderConnection } from "@omnipaper/ocr/runner";
import {
  getOcrSettings,
  ocrSettingsSchema,
  setOcrSettings,
} from "@omnipaper/settings/ocr-settings";
import {
  getProviderKeys,
  providerKeysSchema,
  providerTestSchema,
  setProviderKeys,
} from "@omnipaper/settings/provider-settings";
import { SECRET_MASK, redactSecrets, unmaskSecret } from "@omnipaper/settings/secret";
import {
  getStorageSettings,
  setStorageSettings,
  storageSettingsSchema,
} from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";
import { Hono } from "hono";
import type { Variables } from "../context";
import { requireAdmin } from "../middleware";

// Platform-wide settings — global admin only. Auth is enforced in app.ts for /settings/*.
const adminSettings = new Hono<{ Variables: Variables }>()
  .use("*", requireAdmin)
  .get("/storage", async (c) => {
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
  .put("/storage", zValidator("json", storageSettingsSchema), async (c) => {
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
  .post("/storage/test", zValidator("json", storageSettingsSchema), async (c) => {
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
  .get("/ocr", async (c) => {
    const ocr = await getOcrSettings();
    const keys = await getProviderKeys();
    const definition = getOcrDefinition(ocr.definitionId);

    return c.json({
      configured: Boolean(keys[definition.provider]),
      definitionId: ocr.definitionId,
      model: resolveModel(definition, ocr.model),
      definitions: listOcrDefinitions().map((d) => ({
        id: d.id,
        label: d.label,
        provider: d.provider,
        lane: d.lane,
        modelEditable: d.modelEditable,
        defaultModel: d.defaultModel,
      })),
    });
  })
  .put("/ocr", zValidator("json", ocrSettingsSchema), async (c) => {
    await setOcrSettings(c.req.valid("json"));
    return c.json({ ok: true });
  })
  .get("/providers", async (c) => {
    const keys = await getProviderKeys();

    return c.json({
      mistral: keys.mistral ? SECRET_MASK : null,
      google: keys.google ? SECRET_MASK : null,
    });
  })
  .put("/providers", zValidator("json", providerKeysSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getProviderKeys();

    // A key left as SECRET_MASK means the admin didn't change it → keep the stored value.
    await setProviderKeys({
      mistral:
        incoming.mistral === undefined ? undefined : unmaskSecret(incoming.mistral, stored.mistral),
      google:
        incoming.google === undefined ? undefined : unmaskSecret(incoming.google, stored.google),
    });

    return c.json({ ok: true });
  })
  .post("/providers/test", zValidator("json", providerTestSchema), async (c) => {
    const { provider, apiKey } = c.req.valid("json");
    const stored = await getProviderKeys();
    const key = unmaskSecret(apiKey, stored[provider]);

    try {
      await testProviderConnection(
        provider,
        provider === "mistral" ? { mistral: key } : { google: key },
      );
      return c.json({ ok: true, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      return c.json({ ok: false, error: redactSecrets(message, key) });
    }
  });

export const settingsRoutes = adminSettings;
