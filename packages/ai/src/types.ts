import type { AiAssignParams } from "@omnipaper/shared/workflows/ai-assign";
import type { AiProvider } from "./model";

export type ClassifyCandidates = {
  documentTypes: { name: string; description: string | null }[];
  storagePaths: { path: string; description: string | null }[];
  tags: { name: string }[];
  customFields: { name: string; type: string; description: string | null; options: string[] }[];
};

export type ClassifyResult = {
  documentType?: string | null;
  storagePath?: string | null;
  tags?: string[];
  documentDate?: string | null;
  title?: string | null;
  customFields?: { field: string; value: string | null }[];
};

export type ClassifyInput = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  fields: AiAssignParams;
  candidates: ClassifyCandidates;
  reservedTagNames: string[];
  ocrText: string;
};
