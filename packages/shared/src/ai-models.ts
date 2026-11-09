import { z } from "zod";
import bundledManifestJson from "./model-manifest.json";

export const AI_MODEL_PROVIDERS = ["openai", "anthropic", "google", "mistral"] as const;

export type AiModelProvider = (typeof AI_MODEL_PROVIDERS)[number];

export const RECOMMENDED_MODEL = "recommended" as const;

const modelSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  status: z.enum(["current", "legacy"]),
  releasedAt: z.string().optional(),
});

const providerCatalogSchema = z
  .object({
    defaults: z.object({ recommended: z.string().trim().min(1) }),
    models: z.array(modelSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const slugs = new Set<string>();
    for (const model of catalog.models) {
      if (slugs.has(model.slug)) {
        ctx.addIssue({ code: "custom", message: `Duplicate model slug ${model.slug}` });
      }
      slugs.add(model.slug);
    }
    if (!slugs.has(catalog.defaults.recommended)) {
      ctx.addIssue({ code: "custom", message: "Recommended model is not in the model list" });
    }
  });

// Providers keyed by plain string: an older release must still accept a manifest that lists a
// provider it doesn't know yet.
export const modelManifestSchema = z.object({
  version: z.literal(1),
  updatedAt: z.iso.datetime(),
  providers: z.record(z.string(), providerCatalogSchema),
});

export type AiModel = z.infer<typeof modelSchema>;
export type AiProviderCatalog = z.infer<typeof providerCatalogSchema>;
export type ModelManifest = z.infer<typeof modelManifestSchema>;

export const BUNDLED_MODEL_MANIFEST: ModelManifest = modelManifestSchema.parse(bundledManifestJson);

for (const provider of AI_MODEL_PROVIDERS) {
  if (!BUNDLED_MODEL_MANIFEST.providers[provider]) {
    throw new Error(`model-manifest.json is missing provider ${provider}`);
  }
}

export function manifestUpdatedAtMs(manifest: ModelManifest): number {
  return Date.parse(manifest.updatedAt);
}

export function getProviderCatalog(
  manifest: ModelManifest,
  provider: AiModelProvider,
): AiProviderCatalog {
  return (
    manifest.providers[provider] ??
    (BUNDLED_MODEL_MANIFEST.providers[provider] as AiProviderCatalog)
  );
}

// A pinned id passes through untouched even when the catalog no longer lists it: the provider API
// decides whether it exists, and a stale catalog must never silently swap a paid model.
export function resolveAiModel(catalog: AiProviderCatalog, model: string): string {
  return model === RECOMMENDED_MODEL ? catalog.defaults.recommended : model;
}
