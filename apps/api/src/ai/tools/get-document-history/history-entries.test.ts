import { describe, expect, test } from "bun:test";
import { type HistoryLookups, toSuggestionEntries } from "./history-entries";

const AT = new Date("2026-09-14T10:00:00.000Z");

const lookups: HistoryLookups = {
  documentTypes: new Map([["dtype_1", "Faktura"]]),
  storagePaths: new Map([["path_7", "/faktury"]]),
  tags: new Map([["tag_9", "telekomunikacja"]]),
  definitions: new Map([
    ["cpd_5", { name: "Kategoria", options: new Map([["cpo_7", "Abonament"]]) }],
  ]),
};

function row(overrides: Partial<Parameters<typeof toSuggestionEntries>[0]>) {
  return {
    field: "documentType" as const,
    customPropertyDefinitionId: null,
    suggestedValue: { id: "dtype_1" },
    status: "pending" as const,
    createdAt: AT,
    resolvedAt: null,
    resolvedByName: null,
    ...overrides,
  };
}

describe("toSuggestionEntries", () => {
  test("accepted suggestions are skipped (they exist as change rows)", () => {
    expect(toSuggestionEntries(row({ status: "accepted" }), lookups)).toEqual([]);
  });

  test("entity reference resolves to id + current name", () => {
    expect(toSuggestionEntries(row({}), lookups)).toEqual([
      expect.objectContaining({
        kind: "suggestion",
        field: "documentType",
        status: "pending",
        value: { id: "dtype_1", name: "Faktura" },
      }),
    ]);
  });

  test("tag set fans out into one entry per tag, new names as values", () => {
    const entries = toSuggestionEntries(
      row({
        field: "tags",
        suggestedValue: { existingIds: ["tag_9", "tag_gone"], newNames: ["leasing"] },
      }),
      lookups,
    );
    expect(entries.map((e) => ("value" in e ? e.value : null))).toEqual([
      { id: "tag_9", name: "telekomunikacja" },
      { id: "tag_gone", name: "(deleted)" },
      { value: "leasing" },
    ]);
  });

  test("select option resolves label through its definition", () => {
    const entries = toSuggestionEntries(
      row({
        field: "customProperty",
        customPropertyDefinitionId: "cpd_5",
        suggestedValue: { selectOptionId: "cpo_7" },
        status: "dismissed",
        resolvedAt: AT,
        resolvedByName: "Mateusz",
      }),
      lookups,
    );
    expect(entries).toEqual([
      expect.objectContaining({
        definition: { id: "cpd_5", name: "Kategoria" },
        value: { id: "cpo_7", name: "Abonament" },
        status: "dismissed",
        resolvedBy: "Mateusz",
        resolvedAt: AT.toISOString(),
      }),
    ]);
  });
});
