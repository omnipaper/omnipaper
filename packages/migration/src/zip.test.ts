import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Readable } from "node:stream";
import { streamManifestRecords } from "./manifest";
import { paperlessAdapter } from "./paperless/adapter";
import { openZip, type ZipSource } from "./zip";

// Integration test against a real (committed) ZIP fixture — exercises the yauzl reader and the
// stream-json manifest parser end-to-end under Bun, which the in-memory fakes in adapter.test.ts
// can't cover.
const FIXTURE = `${import.meta.dir}/__fixtures__/export-sample.zip`;

async function readToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("openZip (real archive)", () => {
  let zip: ZipSource;

  beforeAll(async () => {
    zip = await openZip(FIXTURE);
  });

  afterAll(async () => {
    await zip.close();
  });

  it("lists entries and reports presence", () => {
    const names = zip.listEntries().map((e) => e.name);
    expect(names).toContain("manifest.json");
    expect(names).toContain("metadata.json");
    expect(names).toContain("hello.pdf");
    expect(zip.hasEntry("hello.pdf")).toBe(true);
    expect(zip.hasEntry("missing.pdf")).toBe(false);
    // The symlink entry in the fixture is skipped (path-traversal guard), never listed or readable.
    expect(names).not.toContain("evil-link");
    expect(zip.hasEntry("evil-link")).toBe(false);
  });

  it("streams an entry's bytes", async () => {
    const content = await readToString(await zip.openReadStream("hello.pdf"));
    expect(content).toBe("%PDF-1.4 fake pdf bytes for the fixture");
  });

  it("rejects a missing entry", async () => {
    await expect(zip.openReadStream("nope.pdf")).rejects.toThrow();
  });

  it("stream-parses the manifest into records", async () => {
    const records = [];
    for await (const rec of streamManifestRecords(await zip.openReadStream("manifest.json"))) {
      records.push(rec);
    }
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.model)).toEqual([
      "documents.tag",
      "documents.correspondent",
      "documents.document",
    ]);
  });

  it("runs the Paperless adapter end-to-end on the real archive", async () => {
    const result = await paperlessAdapter.analyze(zip);
    expect(result.counts.documents).toBe(1);
    expect(result.counts.tags).toBe(1);
    expect(result.missingFiles).toEqual([]);

    const ir = await paperlessAdapter.buildIntermediate(zip);
    expect(ir.documents[0]?.correspondent).toBe("ACME");
    expect(ir.documents[0]?.fileRef).toBe("hello.pdf");
  });
});
