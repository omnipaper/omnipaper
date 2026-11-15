import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "max-comment-density", source });

const code = (count: number) =>
  Array.from({ length: count }, (_, i) => `export const v${i} = ${i};`).join("\n");
const comments = (count: number) =>
  Array.from({ length: count }, (_, i) => `// reason ${i}`).join("\n");

describe("omnipaper/max-comment-density", () => {
  it("allows a few comment lines in a small file", () => {
    expect(lint(`${comments(3)}\n${code(2)}`)).toEqual([]);
  });

  it("reports a small file past the free allowance", () => {
    expect(lint(`${comments(4)}\n${code(2)}`)).toHaveLength(1);
  });

  it("allows up to 12% in a larger file", () => {
    // 6 of 50 non-blank lines.
    expect(lint(`${comments(6)}\n${code(44)}`)).toEqual([]);
  });

  it("reports a larger file over 12%", () => {
    // 7 of 50 non-blank lines.
    expect(lint(`${comments(7)}\n${code(43)}`)).toHaveLength(1);
  });

  it("counts every line of a block comment", () => {
    expect(lint(`/*\n one\n two\n three\n*/\n${code(2)}`)).toHaveLength(1);
  });

  it("ignores trailing comments and directives", () => {
    const trailing = Array.from({ length: 5 }, (_, i) => `export const t${i} = ${i}; // note`);
    const directives = Array.from({ length: 5 }, () => "// oxlint-disable-next-line no-console");
    expect(lint([...trailing, ...directives, code(2)].join("\n"))).toEqual([]);
  });
});
