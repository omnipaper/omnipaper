import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import { generateText, Output, stepCountIs, tool } from "ai";
import { z } from "zod";
import { type AiProvider, resolveModel } from "./model";

const OCR_HEAD_CHARS = 12000;
const MAX_STEPS = 4;
const TITLE_MAX = 200;
const TIMEOUT_MS = 60_000;

// Names only: this package builds the prompt + enum from them and never touches org ids. The
// executor passes names in and resolves the returned names back to ids (approach B).
export type ClassifyCandidates = {
  documentTypes: { name: string; description: string | null }[];
  storagePaths: { path: string; description: string | null }[];
  tags: { name: string }[];
};

// Flat, name-based output mirroring the model. The executor resolves names -> ids against the org.
export type ClassifyResult = {
  documentType?: string | null;
  storagePath?: string | null;
  tags?: string[];
  title?: string | null;
};

export type ClassifyInput = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  fields: AiAssignParams;
  candidates: ClassifyCandidates;
  ocrText: string;
};

// Only enabled fields with something to choose from enter the schema; type/path are enum-constrained
// to the provided names so the model cannot invent options.
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
  if (fields.title) {
    shape.title = z.string().nullable();
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
  if (fields.title) {
    sections.push("## Title\nProvide a short, human-readable title for the document.");
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

// Cleanup only (trim, dedupe, cap). Name -> id resolution is the executor's job (approach B); for
// document type / storage path the executor's lookup also acts as validation (unknown name -> dropped).
function normalizeOutput(input: ClassifyInput, raw: ClassifyResult): ClassifyResult {
  const { fields } = input;
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
  if (fields.title) {
    const value = raw.title?.trim();
    out.title = value ? value.slice(0, TITLE_MAX) : null;
  }

  return out;
}

// One structured call covering all enabled fields. A read_document_ocr tool lets the model pull more
// of the text on demand (capped by stopWhen); short documents never call it, so cost stays near a
// single classification. Returns flat names; the executor resolves them to org ids.
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
  });
  console.log(result.output);

  return normalizeOutput(input, result.output as ClassifyResult);
}
