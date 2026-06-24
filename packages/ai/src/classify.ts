import { env } from "@omnipaper/env";
import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";
import { type AiProvider, resolveModel } from "./model";

const OCR_HEAD_CHARS = 12000;
const MAX_STEPS = 4;
const TITLE_MAX = 200;
const TIMEOUT_MS = 60_000;

export type ClassifyCandidates = {
  documentTypes: { name: string; description: string | null }[];
  storagePaths: { path: string; description: string | null }[];
  tags: { name: string }[];
  customFields: { name: string; type: string; description: string | null; options: string[] }[];
};

export type ClassifyResult = {
  documentType?: string | null;
  storagePath?: string | null;
  tags?: string[];
  documentDate?: string | null;
  title?: string | null;
  customFields?: { field: string; value: string | null }[];
};

export type ClassifyInput = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  fields: AiAssignParams;
  candidates: ClassifyCandidates;
  ocrText: string;
};

function buildSchema(input: ClassifyInput) {
  const { fields, candidates } = input;
  const shape: Record<string, z.ZodTypeAny> = {};

  if (fields.documentType && candidates.documentTypes.length > 0) {
    const names = candidates.documentTypes.map((t) => t.name) as [string, ...string[]];
    shape.documentType = z.enum(names).nullable();
  }
  if (fields.storagePath && candidates.storagePaths.length > 0) {
    const paths = candidates.storagePaths.map((p) => p.path) as [string, ...string[]];
    shape.storagePath = z.enum(paths).nullable();
  }
  if (fields.tags) {
    shape.tags = z.array(z.string());
  }
  if (fields.documentDate) {
    shape.documentDate = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable();
  }
  if (fields.title) {
    shape.title = z.string().nullable();
  }
  if (fields.customFields && candidates.customFields.length > 0) {
    const fieldNames = candidates.customFields.map((c) => c.name) as [string, ...string[]];
    shape.customFields = z.array(
      z.object({ field: z.enum(fieldNames), value: z.string().nullable() }),
    );
  }

  return z.object(shape);
}

function buildPrompt(input: ClassifyInput) {
  const { fields, candidates, ocrText } = input;
  const sections: string[] = [];

  if (fields.documentType && candidates.documentTypes.length > 0) {
    const lines = candidates.documentTypes
      .map((t) => (t.description ? `${t.name} — ${t.description}` : t.name))
      .join("\n");
    sections.push(`## Document types (pick one name, or null)\n${lines}`);
  }
  if (fields.storagePath && candidates.storagePaths.length > 0) {
    const lines = candidates.storagePaths
      .map((p) => (p.description ? `${p.path} — ${p.description}` : p.path))
      .join("\n");
    sections.push(`## Storage paths (pick one path, or null)\n${lines}`);
  }
  if (fields.tags) {
    const existing = candidates.tags.map((t) => t.name).join(", ");
    sections.push(
      `## Tags (reuse these names where they fit; you may also propose new ones)\n${existing || "(none yet)"}`,
    );
  }
  if (fields.documentDate) {
    sections.push(
      "## Document date\nThe date the document is about, as YYYY-MM-DD, only if it appears in the text; use null if absent.",
    );
  }
  if (fields.title) {
    sections.push("## Title\nProvide a short, human-readable title for the document.");
  }
  if (fields.customFields && candidates.customFields.length > 0) {
    const lines = candidates.customFields
      .map((c) => {
        const desc = c.description ? ` — ${c.description}` : "";
        const opts =
          c.type === "select" && c.options.length > 0 ? ` (options: ${c.options.join(", ")})` : "";
        return `${c.name} [${c.type}]${desc}${opts}`;
      })
      .join("\n");
    sections.push(
      `## Custom fields (fill by field name; value as text, for select use one of its options; omit if absent)\n${lines}`,
    );
  }

  const head = ocrText.slice(0, OCR_HEAD_CHARS);
  const truncated = ocrText.length > OCR_HEAD_CHARS;

  const system = [
    "You extract structured metadata for a single document.",
    "Rules:",
    "- Choose values ONLY from the provided options, by their exact name. Never invent options.",
    "- If nothing clearly fits a field, return null for it. Do not guess.",
    "- Tags: prefer existing names; only propose a new one when clearly warranted.",
    "- Title: concise and human-readable.",
    truncated
      ? "- The document text is truncated; call read_document_ocr to read more if you need it."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${sections.join("\n\n")}\n\n## Document text${
    truncated ? " (truncated)" : ""
  }\n${head}`;

  return { system, prompt };
}

function normalizeOutput(input: ClassifyInput, raw: ClassifyResult): ClassifyResult {
  const { fields, candidates } = input;
  const out: ClassifyResult = {};

  if (fields.documentType) {
    out.documentType = raw.documentType ?? null;
  }
  if (fields.storagePath) {
    out.storagePath = raw.storagePath ?? null;
  }
  if (fields.tags) {
    const seen = new Set<string>();
    out.tags = (raw.tags ?? [])
      .map((name) => name.trim())
      .filter((name) => {
        const key = name.toLowerCase();
        if (!name || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }
  if (fields.documentDate) {
    out.documentDate = raw.documentDate ?? null;
  }
  if (fields.title) {
    const value = raw.title?.trim();
    out.title = value ? value.slice(0, TITLE_MAX) : null;
  }
  if (fields.customFields) {
    const known = new Set(candidates.customFields.map((c) => c.name));
    out.customFields = (raw.customFields ?? []).filter(
      (c) => known.has(c.field) && c.value != null,
    );
  }

  return out;
}

export async function classifyDocument(input: ClassifyInput): Promise<ClassifyResult> {
  const { system, prompt } = buildPrompt(input);

  const readDocumentOcr = tool({
    description:
      "Read a slice of the document's full OCR text when the provided text is truncated.",
    inputSchema: z.object({
      offset: z.number().int().min(0),
      length: z.number().int().min(1).max(20000),
    }),
    execute: async ({ offset, length }) => ({
      text: input.ocrText.slice(offset, offset + length),
      totalLength: input.ocrText.length,
    }),
  });

  const result = await generateText({
    model: resolveModel(input.provider, input.model, input.apiKey),
    tools: { read_document_ocr: readDocumentOcr },
    stopWhen: stepCountIs(MAX_STEPS),
    output: Output.object({ schema: buildSchema(input) }),
    system,
    prompt,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    experimental_telemetry: {
      isEnabled: process.env.NODE_ENV !== "production" && Boolean(env.LANGFUSE_PUBLIC_KEY),
    },
  });

  return normalizeOutput(input, result.output as ClassifyResult);
}
