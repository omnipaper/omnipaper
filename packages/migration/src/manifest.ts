import type { Readable } from "node:stream";
import { streamArray } from "stream-json/streamers/stream-array.js";

export type ManifestRecord = {
  model: string;
  pk: number | string;
  fields: Record<string, unknown>;
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

export async function* streamManifestRecords(source: Readable): AsyncGenerator<ManifestRecord> {
  const pipeline = source.pipe(streamArray.withParserAsStream());

  for await (const item of pipeline) {
    const value = (item as { value: unknown }).value;
    if (isManifestRecord(value)) {
      yield value;
    }
  }
}
