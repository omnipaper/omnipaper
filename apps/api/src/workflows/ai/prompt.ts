import type { AiAssignFields } from "@omnipaper/shared/workflows";
import type { AiCandidates } from "./candidates";
import { NO_MATCH } from "./schema";

// One prompt covering every enabled field — OCR text dominates the token cost and is sent once, so N
// per-field prompts would be N× the price for no gain (and lose cross-field coherence). The candidate
// id→label→description maps live in the prompt body, not the schema enum, because descriptions are
// exactly what document_types / storage_paths carry to disambiguate choices.

// Cap the text we send: enough for classification, bounded so a huge document can't blow the context.
const MAX_TEXT_CHARS = 24_000;

export function buildClassifyPrompts(params: {
  fields: AiAssignFields;
  candidates: AiCandidates;
  ocrText: string;
}): { system: string; prompt: string } {
  const { fields, candidates } = params;
  const sections: string[] = [
    "You classify a document and fill metadata fields. Use ONLY the document's text below.",
    `When nothing fits a single-choice field, return "${NO_MATCH}". Never invent ids or values.`,
    "Set confidence in [0,1] reflecting how sure you are.",
  ];

  if (fields.documentType) {
    sections.push(
      list(
        "Document types — choose one id:",
        candidates.documentTypes.map((t) => `${t.id} = "${t.name}"${describe(t.description)}`),
      ),
    );
  }

  if (fields.storagePath) {
    sections.push(
      list(
        "Storage paths — choose one id:",
        candidates.storagePaths.map((p) => `${p.id} = "${p.path}"${describe(p.description)}`),
      ),
    );
  }

  if (fields.tags) {
    const allowNew = fields.tags.allowNew;
    sections.push(
      list(
        `Tags — pick relevant existing ids (existingIds), up to ${fields.tags.max}${allowNew ? "; you may also propose concise new tag names (newNames)" : "; do NOT invent new names"}:`,
        candidates.tags.map((t) => `${t.id} = "${t.name}"`),
      ),
    );
  }

  if (fields.documentDate) {
    sections.push(
      "Document date — the date the document is *about* (e.g. invoice/issue date), as YYYY-MM-DD. " +
        "Put the exact substring you read it from in `quote`. If absent, return null.",
    );
  }

  if (fields.customFields) {
    sections.push(
      list(
        "Custom fields — for each, return { definitionId, value }. For select fields return selectOptionId from its options; otherwise put the text in `value`:",
        candidates.customFields.map((f) => {
          const options =
            f.type === "select"
              ? ` options: ${f.options.map((o) => `${o.id}="${o.label}"`).join(", ")}`
              : "";
          return `${f.id} = "${f.name}" (${f.type})${describe(f.description)}${options}`;
        }),
      ),
    );
  }

  const text = params.ocrText.slice(0, MAX_TEXT_CHARS);

  return {
    system: sections.join("\n\n"),
    prompt: `Document text:\n"""\n${text}\n"""`,
  };
}

function describe(description: string | null): string {
  return description ? ` — ${description}` : "";
}

function list(heading: string, lines: string[]): string {
  if (lines.length === 0) {
    return `${heading}\n  (none defined)`;
  }
  return `${heading}\n${lines.map((line) => `  ${line}`).join("\n")}`;
}
