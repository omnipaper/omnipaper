import { zValidator } from "@hono/zod-validator";
import { getOcrDefinition, listOcrDefinitions, resolveModel } from "@omnipaper/ocr/resolve";
import { testProviderConnection } from "@omnipaper/ocr/runner";
import {
  getRegistrationSettings,
  registrationSettingsSchema,
  setRegistrationSettings,
} from "@omnipaper/settings/auth-settings";
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
import { SECRET_MASK, unmaskSecret } from "@omnipaper/settings/secret";
import {
  getStorageSettings,
  resolveStorageConfig,
  setStorageSettings,
  storageSettingsSchema,
} from "@omnipaper/settings/storage-settings";
import { redactSecrets } from "@omnipaper/shared/redact";
import { DEFAULT_STORAGE_ENGINE } from "@omnipaper/storage/registry";
import { listStorageDefinitions } from "@omnipaper/storage/resolve";
import { createS3Driver } from "@omnipaper/storage/s3";
import { Hono } from "hono";
import type { Variables } from "../context";
import { type BucketPrivacy, probeBucketPrivacy } from "../lib/bucket-privacy";
import { probePreviewCors } from "../lib/preview-cors";
import { requireAdmin } from "../middleware";

// Platform-wide settings — global admin only. Auth is enforced in app.ts for /settings/*.
const adminSettings = new Hono<{ Variables: Variables }>()
  .use("*", requireAdmin)
  .get("/storage", async (c) => {
    const stored = await getStorageSettings();

    return c.json({
      configured: stored !== null,
      engine: stored?.engine ?? DEFAULT_STORAGE_ENGINE,
      bucket: stored?.bucket ?? null,
      region: stored?.region ?? null,
      endpoint: stored?.endpoint ?? null,
      accessKeyId: stored ? SECRET_MASK : null,
      secretAccessKey: stored ? SECRET_MASK : null,
      // Field-shaping metadata for the form: which engines exist and how each treats
      // region/endpoint. forcePathStyle stays server-side — the admin never sets it.
      engines: listStorageDefinitions().map((d) => ({
        id: d.id,
        label: d.label,
        endpoint: d.endpoint,
        region: { shown: d.region.shown, placeholder: d.region.placeholder },
      })),
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

    // One-off driver from the admin-submitted config — destroy it after the probe so its keep-alive
    // agent doesn't linger (this is NOT the shared cached client from lib/storage.ts).
    const driver = createS3Driver(
      resolveStorageConfig({
        ...incoming,
        accessKeyId: unmaskSecret(incoming.accessKeyId, stored?.accessKeyId),
        secretAccessKey: unmaskSecret(incoming.secretAccessKey, stored?.secretAccessKey),
      }),
    );

    try {
      try {
        await driver.testConnection();
      } catch (error) {
        return c.json({
          ok: false,
          error: error instanceof Error ? error.message : "Connection failed",
          privacy: "unknown" as BucketPrivacy,
        });
      }

      // Connection works — also flag a world-readable bucket (a confidentiality risk for documents).
      // Advisory only: never blocks saving, and stays silent when it can't tell.
      let privacy: BucketPrivacy = "unknown";
      try {
        const { url } = await driver.createDownloadUrl({ key: "__omnipaper_connection_test__" });
        privacy = await probeBucketPrivacy({ url });
      } catch {
        privacy = "unknown";
      }

      return c.json({ ok: true, error: null, privacy });
    } finally {
      driver.destroy();
    }
  })
  .post("/storage/cors-check", zValidator("json", storageSettingsSchema), async (c) => {
    const incoming = c.req.valid("json");
    const stored = await getStorageSettings();

    const driver = createS3Driver(
      resolveStorageConfig({
        ...incoming,
        accessKeyId: unmaskSecret(incoming.accessKeyId, stored?.accessKeyId),
        secretAccessKey: unmaskSecret(incoming.secretAccessKey, stored?.secretAccessKey),
      }),
    );

    // The origin the browser would preview from — sent by the SPA on this POST; fall back to the
    // forwarded host (same logic as auth) for setups where the Origin header is absent.
    const origin =
      c.req.header("origin") ??
      (() => {
        const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
        return host ? `${c.req.header("x-forwarded-proto") ?? "https"}://${host}` : undefined;
      })();

    try {
      const { url } = await driver.createDownloadUrl({ key: "__omnipaper_cors_probe__" });
      return c.json(await probePreviewCors({ url, origin }));
    } finally {
      driver.destroy();
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
  })
  .get("/registration", async (c) => {
    return c.json(await getRegistrationSettings());
  })
  .put("/registration", zValidator("json", registrationSettingsSchema), async (c) => {
    await setRegistrationSettings(c.req.valid("json"));
    return c.json({ ok: true });
  });

export const settingsRoutes = adminSettings;
