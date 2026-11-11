import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "no-named-reexport", source });

describe("omnipaper/no-named-reexport", () => {
  it("reports a named value re-export", () => {
    expect(lint(`export { resolveOcr } from "./resolve";`)).toHaveLength(1);
  });

  it("allows a type-only re-export", () => {
    expect(lint(`export type { OcrError } from "./resolve";`)).toEqual([]);
  });

  it("allows inline type specifiers", () => {
    expect(lint(`export { type OcrError } from "./resolve";`)).toEqual([]);
  });

  it("allows exporting local declarations", () => {
    expect(lint(`const a = 1;\nexport { a };\nexport function b() {}`)).toEqual([]);
  });
});
