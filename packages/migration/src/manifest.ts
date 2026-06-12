import type { Readable } from "node:stream";
import { streamArray } from "stream-json/streamers/stream-array.js";

// A Paperless manifest is a single flat JSON array of Django serializer records, one per entity:
//   { "model": "documents.document", "pk": 42, "fields": { ... }, "__exported_file_name__": "..." }
// We stream it element-by-element so a manifest that embeds every document's OCR text — easily
// hundreds of MB to several GB — never has to be read as one string (past the JS engine's string
// limit) or held whole in memory at parse time.

export type ManifestRecord = {
  model: string;
  pk: number | string;
  fields: Record<string, unknown>;
  // Exporter-injected file pointers live at the top level, beside model/pk/fields.
  [key: string]: unknown;
};

function isManifestRecord(value: unknown): value is ManifestRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "model" in value &&
    typeof (value as { model: unknown }).model === "string" &&
    "fields" in value
  );
}

/**
 * Stream the records of one manifest file. `source` is the raw bytes of a `manifest.json` (or a
 * split `<stem>-manifest.json`); each well-formed `{model, pk, fields}` element is yielded in order.
 * Throws if the stream errors or the JSON is malformed.
 */
export async function* streamManifestRecords(source: Readable): AsyncGenerator<ManifestRecord> {
  // withParserAsStream() is a single Duplex doing parse + array-streaming; its readable side emits
  // { key, value } per array element. The Duplex is itself async-iterable on its readable side.
  const pipeline = source.pipe(streamArray.withParserAsStream());

  for await (const item of pipeline) {
    const value = (item as { value: unknown }).value;
    if (isManifestRecord(value)) {
      yield value;
    }
  }
}
