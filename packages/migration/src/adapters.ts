import type { AnalyzeResult, IntermediateRepresentation } from "./ir";
import { paperlessAdapter } from "./paperless/adapter";
import type { ZipSource } from "./zip";

export type SourceAdapter = {
  readonly source: string;
  identify(zip: ZipSource): Promise<boolean>;
  analyze(zip: ZipSource): Promise<AnalyzeResult>;
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
