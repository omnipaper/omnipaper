import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "zvalidator-hook", source });

describe("omnipaper/zvalidator-hook", () => {
  it("allows zValidator with a third argument", () => {
    expect(lint(`zValidator("json", schema, onValidationError);`)).toEqual([]);
  });

  it("reports zValidator with two arguments", () => {
    expect(lint(`zValidator("json", schema);`)).toHaveLength(1);
  });

  it("reports a multi-line call", () => {
    expect(lint(`zValidator(\n  "json",\n  z.object({ name: z.string() }),\n);`)).toHaveLength(1);
  });

  it("ignores other functions with two arguments", () => {
    expect(lint(`validate("json", schema);`)).toEqual([]);
  });
});
