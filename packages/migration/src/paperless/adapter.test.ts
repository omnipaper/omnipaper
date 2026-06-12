import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import type { ZipSource } from "../zip";
import { paperlessAdapter } from "./adapter";

// In-memory ZipSource: maps entry name → text content. Lets us exercise the whole adapter (manifest
// discovery, streaming parse, resolution) without a real archive — the yauzl-backed reader is
// covered separately in zip.test.ts.
function fakeZip(files: Record<string, string>): ZipSource {
  return {
    listEntries: () =>
      Object.entries(files).map(([name, content]) => ({
        name,
        uncompressedSize: Buffer.byteLength(content),
      })),
    hasEntry: (name) => name in files,
    openReadStream: (name) => {
      const content = files[name];
      if (content === undefined) {
        return Promise.reject(new Error(`not found: ${name}`));
      }
      return Promise.resolve(Readable.from([Buffer.from(content)]));
    },
    close: () => Promise.resolve(),
  };
}

type Record_ = {
  model: string;
  pk: number | string;
  fields: Record<string, unknown>;
  [k: string]: unknown;
};

function manifest(records: Record_[]): string {
  return JSON.stringify(records);
}

function docRecord(pk: number, fields: Record<string, unknown>, exportedName: string): Record_ {
  return {
    model: "documents.document",
    pk,
    fields: { deleted_at: null, archive_serial_number: null, tags: [], ...fields },
    __exported_file_name__: exportedName,
  };
}

describe("paperless adapter — single manifest", () => {
  const files = {
    "manifest.json": manifest([
      { model: "auth.user", pk: 1, fields: { username: "alice" } },
      { model: "documents.correspondent", pk: 5, fields: { name: "ACME", owner: 1 } },
      { model: "documents.tag", pk: 7, fields: { name: "Receipts", color: "#ff0000", owner: 1 } },
      { model: "documents.documenttype", pk: 3, fields: { name: "Invoice", owner: 1 } },
      {
        model: "documents.storagepath",
        pk: 4,
        fields: { name: "Archive", path: "Archive/2024", owner: 1 },
      },
      {
        model: "documents.customfield",
        pk: 9,
        fields: { name: "Reference", data_type: "string" },
      },
      {
        model: "documents.customfieldinstance",
        pk: 100,
        fields: { document: 10, field: 9, value_text: "REF-42" },
      },
      { model: "documents.note", pk: 200, fields: { document: 10, note: "a note" } },
      { model: "documents.savedview", pk: 300, fields: { name: "Inbox view" } },
      { model: "documents.workflow", pk: 400, fields: { name: "Auto-tag" } },
      docRecord(
        10,
        {
          title: "May invoice",
          content: "extracted text",
          created: "2024-05-02",
          added: "2024-05-02T10:00:00Z",
          mime_type: "application/pdf",
          original_filename: "invoice.pdf",
          owner: 1,
          correspondent: 5,
          document_type: 3,
          storage_path: 4,
          tags: [7],
        },
        "invoice.pdf",
      ),
    ]),
    "invoice.pdf": "%PDF fake",
  };

  it("builds the IR with resolved references", async () => {
    const ir = await paperlessAdapter.buildIntermediate(fakeZip(files));

    expect(ir.documents).toHaveLength(1);
    const doc = ir.documents[0];
    expect(doc).toBeDefined();
    if (!doc) return;
    expect(doc.title).toBe("May invoice");
    expect(doc.fileRef).toBe("invoice.pdf");
    expect(doc.ocrText).toBe("extracted text");
    expect(doc.documentDate).toEqual({ kind: "date", value: "2024-05-02" });
    expect(doc.createdAt).toBe("2024-05-02T10:00:00Z");
    expect(doc.correspondent).toBe("ACME");
    expect(doc.owner).toBe("alice");
    expect(doc.typeRef).toBe("3");
    expect(doc.storagePathRef).toBe("4");
    expect(doc.tagRefs).toEqual(["7"]);
    expect(doc.customValues).toEqual([{ defSourceId: "9", kind: "text", value: "REF-42" }]);

    expect(ir.tags).toEqual([
      { sourceId: "7", name: "Receipts", color: "#ff0000", owner: "alice" },
    ]);
    expect(ir.documentTypes).toHaveLength(1);
    expect(ir.storagePaths[0]?.path).toBe("Archive/2024");
    expect(ir.customPropertyDefs).toEqual([{ sourceId: "9", name: "Reference", type: "text" }]);
  });

  it("reports counts and the dropped ledger in analyze", async () => {
    const result = await paperlessAdapter.analyze(fakeZip(files));

    expect(result.counts).toEqual({
      documents: 1,
      tags: 1,
      documentTypes: 1,
      storagePaths: 1,
      customPropertyDefs: 1,
    });
    expect(result.ledger.notes).toBe(1);
    expect(result.ledger.savedViews).toBe(1);
    expect(result.ledger.workflows).toBe(1);
    expect(result.missingFiles).toEqual([]);
    expect(result.mimeBreakdown).toEqual({ "application/pdf": 1 });
    expect(result.needsTimezone).toBe(false);
    expect(result.ownerBreakdown).toEqual([{ owner: "alice", documents: 1 }]);
  });

  it("identifies the archive as a Paperless export", async () => {
    expect(await paperlessAdapter.identify(fakeZip(files))).toBe(true);
    expect(await paperlessAdapter.identify(fakeZip({ "random.txt": "x" }))).toBe(false);
  });
});

describe("paperless adapter — edge cases", () => {
  it("merges same-name taxonomy across owners and reports it + an owner breakdown", async () => {
    const files = {
      "manifest.json": manifest([
        { model: "auth.user", pk: 1, fields: { username: "alice" } },
        { model: "auth.user", pk: 2, fields: { username: "bob" } },
        { model: "documents.tag", pk: 7, fields: { name: "Tax", color: "#111111", owner: 1 } },
        { model: "documents.tag", pk: 8, fields: { name: "Tax", color: "#222222", owner: 2 } },
        docRecord(10, { title: "A", mime_type: "application/pdf", owner: 1, tags: [7] }, "a.pdf"),
        docRecord(11, { title: "B", mime_type: "application/pdf", owner: 2, tags: [8] }, "b.pdf"),
      ]),
      "a.pdf": "x",
      "b.pdf": "y",
    };

    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.ledger.mergedTaxonomy).toContainEqual({ kind: "tag", name: "Tax", count: 2 });
    expect(result.ownerBreakdown).toContainEqual({ owner: "alice", documents: 1 });
    expect(result.ownerBreakdown).toContainEqual({ owner: "bob", documents: 1 });
  });

  it("skips trashed documents (v3.0+ exports)", async () => {
    const files = {
      "manifest.json": manifest([
        docRecord(10, { title: "Live", mime_type: "application/pdf" }, "a.pdf"),
        docRecord(
          11,
          { title: "Trashed", mime_type: "application/pdf", deleted_at: "2024-06-01T00:00:00Z" },
          "b.pdf",
        ),
      ]),
      "a.pdf": "x",
      "b.pdf": "y",
    };

    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.counts.documents).toBe(1);
    expect(result.ledger.trashedDocuments).toBe(1);
  });

  it("drops monetary/documentlink custom fields wholesale", async () => {
    const files = {
      "manifest.json": manifest([
        { model: "documents.customfield", pk: 9, fields: { name: "Price", data_type: "monetary" } },
        {
          model: "documents.customfield",
          pk: 10,
          fields: { name: "Link", data_type: "documentlink" },
        },
        { model: "documents.customfield", pk: 11, fields: { name: "Ref", data_type: "string" } },
      ]),
    };

    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.ledger.droppedCustomFields).toBe(2);
    expect(result.counts.customPropertyDefs).toBe(1);
  });

  it("flags files referenced by the manifest but missing from the archive", async () => {
    const files = {
      "manifest.json": manifest([
        docRecord(10, { title: "Present", mime_type: "application/pdf" }, "here.pdf"),
        docRecord(11, { title: "Absent", mime_type: "application/pdf" }, "gone.pdf"),
      ]),
      "here.pdf": "x",
    };

    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.missingFiles).toEqual(["gone.pdf"]);
  });

  it("detects datetime `created` and asks for a timezone", async () => {
    const files = {
      "manifest.json": manifest([
        docRecord(
          10,
          { title: "Old export", mime_type: "application/pdf", created: "2024-05-01T22:00:00Z" },
          "a.pdf",
        ),
      ]),
      "a.pdf": "x",
    };

    const ir = await paperlessAdapter.buildIntermediate(fakeZip(files));
    expect(ir.documents[0]?.documentDate).toEqual({
      kind: "instant",
      value: "2024-05-01T22:00:00Z",
    });
    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.needsTimezone).toBe(true);
  });

  it("merges a split manifest and attaches an instance that follows its document", async () => {
    const files = {
      // Main manifest: taxonomy + custom-field definition, no documents.
      "manifest.json": manifest([
        { model: "documents.customfield", pk: 9, fields: { name: "Ref", data_type: "string" } },
        { model: "documents.tag", pk: 7, fields: { name: "T", color: "#abcdef", owner: null } },
      ]),
      // Per-document split manifest: the document, THEN its custom-field instance (exporter order).
      "doc-0000010-manifest.json": manifest([
        docRecord(10, { title: "Split doc", mime_type: "application/pdf", tags: [7] }, "split.pdf"),
        {
          model: "documents.customfieldinstance",
          pk: 100,
          fields: { document: 10, field: 9, value_text: "REF-1" },
        },
      ]),
      "split.pdf": "x",
    };

    const ir = await paperlessAdapter.buildIntermediate(fakeZip(files));
    expect(ir.documents).toHaveLength(1);
    expect(ir.documents[0]?.customValues).toEqual([
      { defSourceId: "9", kind: "text", value: "REF-1" },
    ]);
    expect(ir.documents[0]?.tagRefs).toEqual(["7"]);
    expect(ir.customPropertyDefs).toHaveLength(1);
  });

  it("resolves file references under a hand-zipped wrapper folder", async () => {
    const files = {
      "export/manifest.json": manifest([
        docRecord(10, { title: "Wrapped", mime_type: "application/pdf" }, "originals/a.pdf"),
      ]),
      "export/originals/a.pdf": "x",
    };

    const ir = await paperlessAdapter.buildIntermediate(fakeZip(files));
    expect(ir.documents[0]?.fileRef).toBe("export/originals/a.pdf");
    const result = await paperlessAdapter.analyze(fakeZip(files));
    expect(result.missingFiles).toEqual([]);
  });
});
