import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  type AiProviderCatalog,
  BUNDLED_MODEL_MANIFEST,
  getProviderCatalog,
  modelManifestSchema,
  RECOMMENDED_MODEL,
  resolveAiModel,
} from "./ai-models";

const catalog: AiProviderCatalog = {
  defaults: { recommended: "model-b" },
  models: [
    { slug: "model-a", name: "Model A", status: "current" },
    { slug: "model-b", name: "Model B", status: "current" },
  ],
};

const manifest = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  updatedAt: "2026-01-01T00:00:00Z",
  providers: { openai: catalog },
  ...overrides,
});

describe("modelManifestSchema", () => {
  it("accepts a valid manifest and drops unknown fields", () => {
    const parsed = modelManifestSchema.parse(
      manifest({
        providers: { openai: { ...catalog, models: [{ ...catalog.models[1], extra: 1 }] } },
      }),
    );
    expect(parsed.providers.openai?.models[0]).toEqual(
      catalog.models[1] as AiProviderCatalog["models"][number],
    );
  });

  it("rejects an unsupported version", () => {
    expect(modelManifestSchema.safeParse(manifest({ version: 2 })).success).toBe(false);
  });

  it("rejects a recommended model missing from the list", () => {
    const bad = { ...catalog, defaults: { recommended: "model-z" } };
    expect(modelManifestSchema.safeParse(manifest({ providers: { openai: bad } })).success).toBe(
      false,
    );
  });

  it("rejects duplicate slugs", () => {
    const bad = { ...catalog, models: [...catalog.models, catalog.models[0]] };
    expect(modelManifestSchema.safeParse(manifest({ providers: { openai: bad } })).success).toBe(
      false,
    );
  });

  it("accepts providers this release doesn't know", () => {
    expect(
      modelManifestSchema.safeParse(manifest({ providers: { openai: catalog, future: catalog } }))
        .success,
    ).toBe(true);
  });
});

describe("resolveAiModel", () => {
  it("resolves the recommended sentinel", () => {
    expect(resolveAiModel(catalog, RECOMMENDED_MODEL)).toBe("model-b");
  });

  it("passes pinned ids through, even unlisted ones", () => {
    expect(resolveAiModel(catalog, "model-a")).toBe("model-a");
    expect(resolveAiModel(catalog, "model-unlisted")).toBe("model-unlisted");
  });
});

describe("getProviderCatalog", () => {
  it("falls back to the bundled catalog for a provider the remote omits", () => {
    const remote = modelManifestSchema.parse(manifest());
    expect(getProviderCatalog(remote, "mistral")).toEqual(
      BUNDLED_MODEL_MANIFEST.providers.mistral as AiProviderCatalog,
    );
  });
});

describe("published manifest", () => {
  it("matches the copy served from the docs site", async () => {
    const published = await Bun.file(
      join(import.meta.dir, "../../../apps/docs/public/models/v1.json"),
    ).json();
    const bundled = await Bun.file(join(import.meta.dir, "model-manifest.json")).json();
    expect(published).toEqual(bundled);
  });
});
