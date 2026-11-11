import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "max-positional-params", source });

describe("omnipaper/max-positional-params", () => {
  it("allows up to three parameters", () => {
    expect(lint(`function f(a: string, b: string, c: string) {}`)).toEqual([]);
  });

  it("allows an options object", () => {
    expect(lint(`function f(options: { a: string; b: string; c: string; d: string }) {}`)).toEqual(
      [],
    );
  });

  it("reports a function declaration with four parameters", () => {
    expect(lint(`function f(a: string, b: string, c: string, d: string) {}`)).toHaveLength(1);
  });

  it("reports a named arrow function with four parameters", () => {
    expect(lint(`const f = (a: string, b: string, c: string, d: string) => {};`)).toHaveLength(1);
  });

  it("ignores inline callbacks", () => {
    expect(lint(`useMutation({ onError: (a, b, c, d) => {} });`)).toEqual([]);
  });
});
