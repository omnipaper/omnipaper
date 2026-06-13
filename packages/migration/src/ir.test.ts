import { describe, expect, it } from "bun:test";
import { type IRDate, resolveDocumentDate } from "./ir";

describe("resolveDocumentDate", () => {
  it("returns a bare calendar date verbatim, ignoring timezone", () => {
    const date: IRDate = { kind: "date", value: "2024-05-02" };
    expect(resolveDocumentDate(date, "UTC")).toBe("2024-05-02");
    expect(resolveDocumentDate(date, "Europe/Warsaw")).toBe("2024-05-02");
    expect(resolveDocumentDate(date, "America/New_York")).toBe("2024-05-02");
  });

  it("resolves a UTC instant to the user's local date — recovering the +1-day shift", () => {
    const instant: IRDate = { kind: "instant", value: "2024-05-01T22:00:00Z" };
    expect(resolveDocumentDate(instant, "Europe/Warsaw")).toBe("2024-05-02");
    expect(resolveDocumentDate(instant, "UTC")).toBe("2024-05-01");
    expect(resolveDocumentDate(instant, "America/New_York")).toBe("2024-05-01");
  });

  it("handles instants with offsets and fractional seconds", () => {
    expect(resolveDocumentDate({ kind: "instant", value: "2024-05-01T22:00:00.123Z" }, "UTC")).toBe(
      "2024-05-01",
    );
    expect(
      resolveDocumentDate({ kind: "instant", value: "2024-05-02T00:00:00+02:00" }, "Europe/Warsaw"),
    ).toBe("2024-05-02");
  });

  it("returns null for a null date or an unparseable instant", () => {
    expect(resolveDocumentDate(null, "UTC")).toBeNull();
    expect(resolveDocumentDate({ kind: "instant", value: "not-a-date" }, "UTC")).toBeNull();
  });

  it("falls back to the UTC date on an invalid timezone instead of throwing", () => {
    expect(
      resolveDocumentDate({ kind: "instant", value: "2024-05-01T22:00:00Z" }, "Not/AZone"),
    ).toBe("2024-05-01");
  });
});
