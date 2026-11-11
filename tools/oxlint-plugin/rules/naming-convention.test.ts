import { describe, expect, it } from "bun:test";
import { lintFixture } from "../test/lint-fixture";

const lint = (source: string) => lintFixture({ rule: "naming-convention", source });

describe("omnipaper/naming-convention", () => {
  it("allows camelCase, PascalCase and top-level CONSTANT_CASE", () => {
    const source = `
      export const MAX_FILE_SIZE = 10;
      const documentList = [];
      const MdxContent = () => null;
      function parseInvoice(rawInput: string, _unused: number) {}
      type DocumentStatus = "ok";
      interface UploadInput {}
      function first<TName>(value: TName) { return value; }
      const baseURL = "x";
    `;
    expect(lint(source)).toEqual([]);
  });

  it("skips object and type members", () => {
    const source = `
      const config = { DATABASE_URL: "x", image_url: "y", Bucket: "z" };
      type Env = { DATABASE_URL: string };
    `;
    expect(lint(source)).toEqual([]);
  });

  it("reports snake_case variables and parameters", () => {
    const source = `
      const setting_key = "theme";
      function getSetting(setting_name: string) {}
    `;
    expect(lint(source)).toHaveLength(2);
  });

  it("reports CONSTANT_CASE inside a function", () => {
    expect(lint(`function f() { const PINNED_FILTER_KEYS = []; }`)).toHaveLength(1);
  });

  it("reports an all-caps component name", () => {
    expect(lint(`function f() { const MDX = 1; }`)).toHaveLength(1);
  });

  it("reports non-PascalCase types", () => {
    expect(lint(`type document_status = "ok";`)).toHaveLength(1);
  });
});
