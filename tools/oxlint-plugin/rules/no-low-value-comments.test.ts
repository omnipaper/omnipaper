import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "no-low-value-comments", source });

describe("omnipaper/no-low-value-comments", () => {
  it("reports a section divider", () => {
    expect(lint(`// ---------- helpers ----------\nconst a = 1;`)).toHaveLength(1);
  });

  it("reports a test step label", () => {
    expect(lint(`// arrange\nconst a = 1;`)).toHaveLength(1);
  });

  it("reports a TODO without a link", () => {
    expect(lint(`// TODO: handle retries\nconst a = 1;`)).toHaveLength(1);
  });

  it("allows a TODO with a link", () => {
    expect(lint(`// TODO: handle retries https://example.com/1\nconst a = 1;`)).toEqual([]);
  });

  it("reports a bare issue number", () => {
    expect(lint(`// Fixed in #142, the old path leaked\nconst a = 1;`)).toHaveLength(1);
  });

  it("reports a JSDoc type", () => {
    expect(
      lint(`/** @param {string} a the id */\nexport function f(a: string) { return a; }`),
    ).toHaveLength(1);
  });

  it("reports commented-out code", () => {
    expect(lint(`// const b = compute(a);\nconst a = 1;`)).toHaveLength(1);
  });

  it("reports a comment that repeats the name below it", () => {
    expect(lint(`// Get user id\nexport function getUserId() { return 1; }`)).toHaveLength(1);
  });

  it("reports a comment longer than four lines", () => {
    expect(lint(`// one\n// two\n// three\n// four\n// five\nconst a = 1;`)).toHaveLength(1);
  });

  it("allows a short why comment and directives", () => {
    expect(
      lint(
        `// R2 rejects checksum headers, so we hash locally.\n// oxlint-disable-next-line no-console\nconst a = 1;`,
      ),
    ).toEqual([]);
  });
});
