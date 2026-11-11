// The metadata fields whose descriptions guide the classifier. The label is what the prompt calls
// the field so the text stays in the right register.
const KIND_LABELS = {
  tag: "tag",
  documentType: "document type",
  storagePath: "storage path",
  customProperty: "custom property",
} as const;

export type FieldKind = keyof typeof KIND_LABELS;

export type FieldSibling = { name: string; description: string | null };

// Enough for the model to pick up the house style without blowing up the prompt on big orgs.
const MAX_SIBLINGS = 60;

export function buildFieldDescriptionPrompt(input: {
  kind: FieldKind;
  name: string;
  description?: string;
  // Extra facts about the field, e.g. a custom property's value type.
  details?: string;
  siblings: FieldSibling[];
}): { instructions: string; prompt: string } {
  const label = KIND_LABELS[input.kind];
  const draft = input.description?.trim();
  const siblings = input.siblings
    .filter((s) => s.name.trim().toLowerCase() !== input.name.trim().toLowerCase())
    .slice(0, MAX_SIBLINGS);

  const instructions = [
    `You write ${label} descriptions used by an AI that auto-classifies documents.`,
    `A ${label} description tells the classifier when "${input.name}" applies to a document.`,
    draft
      ? "Rewrite the user's draft so it is clear and specific about when this applies."
      : "Write a description from the name alone, saying when this applies.",
    siblings.length > 0
      ? `The other ${label}s of this organization are listed below. Match their style, tone and length, and make clear how "${input.name}" differs from them so the classifier can tell them apart.`
      : `Make clear how "${input.name}" differs from similar ${label}s.`,
    "Keep it to one or two sentences.",
    draft
      ? "Write in the same language as the draft."
      : "Write in the language the existing descriptions use, or the language of the name if there are none.",
    "Return only the description: no quotes, no preamble, no trailing notes.",
  ].join(" ");

  const lines = [`Name: ${input.name}`];
  if (input.details) {
    lines.push(input.details);
  }
  if (draft) {
    lines.push(`Draft description: ${draft}`);
  }
  if (siblings.length > 0) {
    lines.push("", `Other ${label}s:`);
    for (const s of siblings) {
      lines.push(`- ${s.name}: ${s.description?.trim() || "(no description)"}`);
    }
  }

  return { instructions, prompt: lines.join("\n") };
}
