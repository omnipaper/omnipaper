import { describe, expect, it } from "bun:test";
import {
  asRef,
  asRefArray,
  asString,
  extractCustomValue,
  mapCustomFieldType,
  parseCreatedDate,
  parseSelectOptions,
} from "./records";

describe("field readers", () => {
  it("asString returns strings, null otherwise", () => {
    expect(asString("x")).toBe("x");
    expect(asString(3)).toBeNull();
    expect(asString(null)).toBeNull();
  });

  it("asRef stringifies numeric/string pks, null otherwise", () => {
    expect(asRef(42)).toBe("42");
    expect(asRef("42")).toBe("42");
    expect(asRef("")).toBeNull();
    expect(asRef(null)).toBeNull();
  });

  it("asRefArray stringifies a pk list, [] otherwise", () => {
    expect(asRefArray([1, 2, 3])).toEqual(["1", "2", "3"]);
    expect(asRefArray(null)).toEqual([]);
    expect(asRefArray("nope")).toEqual([]);
  });
});

describe("mapCustomFieldType", () => {
  it("maps known Paperless data types", () => {
    expect(mapCustomFieldType("string")).toBe("text");
    expect(mapCustomFieldType("long_text")).toBe("text");
    expect(mapCustomFieldType("url")).toBe("url");
    expect(mapCustomFieldType("date")).toBe("date");
    expect(mapCustomFieldType("boolean")).toBe("boolean");
    expect(mapCustomFieldType("integer")).toBe("number");
    expect(mapCustomFieldType("float")).toBe("number");
    expect(mapCustomFieldType("select")).toBe("select");
  });

  it("returns null for dropped/unknown types", () => {
    expect(mapCustomFieldType("monetary")).toBeNull();
    expect(mapCustomFieldType("documentlink")).toBeNull();
    expect(mapCustomFieldType("whatever")).toBeNull();
  });
});

describe("parseCreatedDate", () => {
  it("detects a bare calendar date", () => {
    expect(parseCreatedDate("2024-05-02")).toEqual({ kind: "date", value: "2024-05-02" });
  });

  it("detects a datetime as an instant", () => {
    expect(parseCreatedDate("2024-05-01T22:00:00Z")).toEqual({
      kind: "instant",
      value: "2024-05-01T22:00:00Z",
    });
  });

  it("returns null for empty/non-string", () => {
    expect(parseCreatedDate("")).toBeNull();
    expect(parseCreatedDate(null)).toBeNull();
    expect(parseCreatedDate(123)).toBeNull();
  });
});

describe("parseSelectOptions", () => {
  it("reads the object form ({id, label})", () => {
    expect(
      parseSelectOptions({
        select_options: [
          { id: "a1", label: "Alpha" },
          { id: "b2", label: "Beta" },
        ],
      }),
    ).toEqual([
      { sourceId: "a1", label: "Alpha" },
      { sourceId: "b2", label: "Beta" },
    ]);
  });

  it("reads the legacy string form (index becomes the id)", () => {
    expect(parseSelectOptions({ select_options: ["Alpha", "Beta"] })).toEqual([
      { sourceId: "0", label: "Alpha" },
      { sourceId: "1", label: "Beta" },
    ]);
  });

  it("returns [] when absent or malformed", () => {
    expect(parseSelectOptions({})).toEqual([]);
    expect(parseSelectOptions(null)).toEqual([]);
  });
});

describe("extractCustomValue", () => {
  it("extracts each value kind by the field's type", () => {
    expect(extractCustomValue({ sourceId: "1", type: "text" }, { value_text: "hi" })).toEqual({
      defSourceId: "1",
      kind: "text",
      value: "hi",
    });
    expect(extractCustomValue({ sourceId: "1", type: "number" }, { value_int: 7 })).toEqual({
      defSourceId: "1",
      kind: "number",
      value: 7,
    });
    expect(extractCustomValue({ sourceId: "1", type: "boolean" }, { value_bool: true })).toEqual({
      defSourceId: "1",
      kind: "boolean",
      value: true,
    });
    expect(
      extractCustomValue({ sourceId: "1", type: "select" }, { value_select: "opt-9" }),
    ).toEqual({
      defSourceId: "1",
      kind: "select",
      optionSourceId: "opt-9",
    });
  });

  it("returns null when the expected value column is absent", () => {
    expect(extractCustomValue({ sourceId: "1", type: "text" }, {})).toBeNull();
    expect(extractCustomValue({ sourceId: "1", type: "number" }, { value_text: "x" })).toBeNull();
  });
});
