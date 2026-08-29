import { describe, expect, it } from "bun:test";
import {
  isValidStoragePath,
  listChildFolders,
  normalizeStoragePath,
  subtreePathIds,
} from "./storage-paths";

describe("normalizeStoragePath", () => {
  it("trims each segment, not just the ends", () => {
    expect(normalizeStoragePath("  /Finance / 2024 ")).toBe("/Finance/2024");
  });

  it("collapses duplicate slashes and drops the trailing one", () => {
    expect(normalizeStoragePath("//Finance//2024/")).toBe("/Finance/2024");
  });

  it("adds the leading slash when missing", () => {
    expect(normalizeStoragePath("Finance/2024")).toBe("/Finance/2024");
  });

  it("normalizes decomposed unicode to NFC", () => {
    expect(normalizeStoragePath("/Księgowość")).toBe("/Księgowość");
  });
});

describe("isValidStoragePath", () => {
  it("accepts letters, digits, underscore and hyphen", () => {
    expect(isValidStoragePath("/Finance/2024")).toBe(true);
    expect(isValidStoragePath("/HR-Docs/umowy_2024")).toBe(true);
  });

  it("accepts messy input that normalizes to a valid path", () => {
    expect(isValidStoragePath("Finance / 2024/")).toBe(true);
  });

  it("rejects spaces inside a segment", () => {
    expect(isValidStoragePath("/Fak tury")).toBe(false);
  });

  it("rejects dots and other special characters", () => {
    expect(isValidStoragePath("/v1.2")).toBe(false);
    expect(isValidStoragePath("/Umowy (2024)")).toBe(false);
  });

  it("rejects diacritics", () => {
    expect(isValidStoragePath("/Księgowość")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidStoragePath("")).toBe(false);
    expect(isValidStoragePath("/")).toBe(false);
  });
});

describe("listChildFolders", () => {
  const rows = [
    { id: "p1", path: "/Finance" },
    { id: "p2", path: "/Finance/2024" },
    { id: "p3", path: "/Finance/2024/Q1" },
    { id: "p4", path: "/HR" },
  ];

  it("lists top-level folders at the root", () => {
    expect(listChildFolders(rows, "/")).toEqual([
      { name: "Finance", path: "/Finance", pathId: "p1" },
      { name: "HR", path: "/HR", pathId: "p4" },
    ]);
  });

  it("returns each child once even when many paths pass through it", () => {
    expect(listChildFolders(rows, "/Finance")).toEqual([
      { name: "2024", path: "/Finance/2024", pathId: "p2" },
    ]);
  });

  it("derives a virtual folder when only a deeper path exists", () => {
    expect(listChildFolders([{ id: "p1", path: "/finance/2024/Q1" }], "/finance")).toEqual([
      { name: "2024", path: "/finance/2024", pathId: null },
    ]);
  });

  it("does not treat /fin as an ancestor of /finance", () => {
    expect(listChildFolders([{ id: "p1", path: "/finance/2024" }], "/fin")).toEqual([]);
  });
});

describe("subtreePathIds", () => {
  const rows = [
    { id: "p1", path: "/Finance" },
    { id: "p2", path: "/Finance/2024" },
    { id: "p3", path: "/HR" },
    { id: "p4", path: "/Fin" },
  ];

  it("includes the folder's own row and every descendant", () => {
    expect(subtreePathIds(rows, "/Finance")).toEqual(["p1", "p2"]);
  });

  it("does not include siblings that share a string prefix", () => {
    expect(subtreePathIds(rows, "/Fin")).toEqual(["p4"]);
  });

  it("returns every id for the root", () => {
    expect(subtreePathIds(rows, "/")).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
