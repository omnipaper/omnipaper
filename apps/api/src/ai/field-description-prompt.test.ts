import { describe, expect, test } from "bun:test";
import { buildFieldDescriptionPrompt } from "./field-description-prompt";

describe("buildFieldDescriptionPrompt", () => {
  test("lists the other rows so the text matches their style", () => {
    const { instructions, prompt } = buildFieldDescriptionPrompt({
      kind: "storagePath",
      name: "/Finance/Invoices",
      siblings: [
        { name: "/Finance/Receipts", description: "Paragony ze sklepów." },
        { name: "/Home", description: null },
      ],
    });

    expect(instructions).toContain("Write a description from the name alone");
    expect(instructions).toContain("Match their style");
    expect(prompt).toBe(
      [
        "Name: /Finance/Invoices",
        "",
        "Other storage paths:",
        "- /Finance/Receipts: Paragony ze sklepów.",
        "- /Home: (no description)",
      ].join("\n"),
    );
  });

  test("a draft is rewritten instead of generated", () => {
    const { instructions, prompt } = buildFieldDescriptionPrompt({
      kind: "tag",
      name: "Invoice",
      description: "  bills  ",
      siblings: [],
    });

    expect(instructions).toContain("Rewrite the user's draft");
    expect(instructions).toContain("same language as the draft");
    expect(prompt).toBe("Name: Invoice\nDraft description: bills");
  });

  test("drops a sibling with the same name and keeps details", () => {
    const { prompt } = buildFieldDescriptionPrompt({
      kind: "customProperty",
      name: "Due date",
      details: "Value type: date",
      siblings: [{ name: "due date", description: "old" }],
    });

    expect(prompt).toBe("Name: Due date\nValue type: date");
  });
});
