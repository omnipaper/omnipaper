import type { AnalyzeResult, IntermediateRepresentation } from "./ir";
import { paperlessAdapter } from "./paperless/adapter";
import type { ZipSource } from "./zip";

// A source adapter is the only code specific to a given external system. It turns that system's
// export (as a ZipSource) into the source-agnostic IR; the import engine consumes only the IR.
export type SourceAdapter = {
  /** Stable source key, e.g. "paperless". */
  readonly source: string;
  /** Cheap check that this archive looks like this source's export. */
  identify(zip: ZipSource): Promise<boolean>;
  /** Parse metadata into preview stats + a loss ledger (no document bytes read). */
  analyze(zip: ZipSource): Promise<AnalyzeResult>;
  /**
   * Build the full intermediate representation for import. Each document's `fileRef` is the archive
   * entry name the engine reads (via `ZipSource.openReadStream`) to get the original bytes.
   */
  buildIntermediate(zip: ZipSource): Promise<IntermediateRepresentation>;
};

const ADAPTERS: Record<string, SourceAdapter> = {
  [paperlessAdapter.source]: paperlessAdapter,
};

export function getSourceAdapter(source: string): SourceAdapter {
  const adapter = ADAPTERS[source];
  if (!adapter) {
    throw new Error(`Unknown migration source: ${source}`);
  }
  return adapter;
}

export function listSourceAdapterNames(): string[] {
  return Object.keys(ADAPTERS);
}
