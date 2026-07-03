import { generateText, isStepCount } from "ai";
import { resolveModel } from "./model";
import { readDocumentOcrTool } from "./tools/read-document-ocr";
import { submitDocumentMetadataTool } from "./tools/submit-document-metadata";
import type { ClassifyInput, ClassifyResult } from "./types";

const OCR_HEAD_CHARS = 12000;
const MAX_STEPS = 6;
const TIMEOUT_MS = 60_000;

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
  if (fields.tags && input.reservedTagNames.length > 0) {
    sections.push(
      `## Excluded tags (these names already exist but are off-limits; never use or recreate them)\n${input.reservedTagNames.join(", ")}`,
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
    "- When every value is ready, call submit_document_metadata exactly once to record them. If it returns errors, correct only those fields and call it again.",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${sections.join("\n\n")}\n\n## Document text${
    truncated ? " (truncated)" : ""
  }\n${head}`;

  return { system, prompt };
}

export async function classifyDocument(input: ClassifyInput): Promise<ClassifyResult> {
  const { system: instructions, prompt } = buildPrompt(input);
  const submit = submitDocumentMetadataTool(input);

  await generateText({
    model: resolveModel(input.provider, input.model, input.apiKey),
    tools: {
      read_document_ocr: readDocumentOcrTool(input.ocrText),
      submit_document_metadata: submit.tool,
    },
    stopWhen: [isStepCount(MAX_STEPS), submit.isDone],
    instructions,
    prompt,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    telemetry: {
      functionId: "classify-document",
    },
  });

  if (!submit.isDone()) {
    console.warn("[classify] classify-document produced no valid submission");
  }

  return submit.getResult();
}
